import {DOMParser} from "prosemirror-model";
import {EditorState} from "prosemirror-state";
import {baseKeymap} from "prosemirror-commands";
import {keymap} from "prosemirror-keymap";
import {schema} from "../schema";
import {history, undo, redo} from "prosemirror-history";

export class TextEditor {
  constructor(defaultTextFormat, editorState, revision) {
    // Our default font size, basically. Type is - `TextFormat`.
    this.defaultTextFormat = defaultTextFormat;
    // ProseMirror's Editor State
    this.editorState = editorState;
    // This `revision` integer is to make it work in React/Redux environment. It seems like since ProseMirror 0.15 we
    // can't just send the ProseMirror state to reducers, handle it there, then return to the view and rerender
    // the view with the updated state, because now there's some rendering happens in place, and if you type
    // fast enough, the state could be corrupted. Instead, we now update the view right in `onAction`, and send the
    // state to store in the global state as well. We use `revision` to enumerate revisions of the state, and in case
    // we send the older state with props to ProseMirror component - we'll just ignore it.
    this.revision = revision;
  }

  static create(fromDOMNode) {
    const defaultTextFormat = new TextFormat(14);
    const doc = DOMParser.fromSchema(schema).parse(fromDOMNode, {preserveWhitespace: true});
    let editorState = EditorState.create({
        doc: doc,
        plugins: [
            keymap(baseKeymap),
            keymap(buildKeymap()),
            history()]});

    // If the initial string value of the editor is empty, we apply stored marks from our default text format.
    // Our goal is to make sure all the content inside the editor always contains a font size mark. Is there a better
    // way to ensure that?
    if (fromDOMNode.textContent === "") {
      editorState = Object.keys(defaultTextFormat).reduce((es, name) => {
        return es.applyAction(
          {type: "addStoredMark", mark: schema.mark(name, {value: defaultTextFormat[name]})}
        );
      }, editorState);
    }
    return new TextEditor(defaultTextFormat, editorState, 0);
  }

  applyAction(action) {
    const oldState = this.editorState;
    let newState = this.editorState.applyAction(action);

    // All the code down below is to ensure we preserve the marks when we go to the next line, paste content, etc.
    // Usually for that we need to combine marks from 'from' of the previous state, from 'from' and 'to' of the new
    // state, and stored marks. Hopefully, I didn't miss anything...
    const oldFrom = oldState.selection.from;
    const newTo = newState.selection.to;
    const newContentSize = newState.doc.content.size;

    // To ensure history works fine, we need to mark all the actions later below as `addToHistory = false`.
    // It seems to help to now screw the undo/redo history. The type is Array<(st: State) => Action>
    const actions = [];

    // Since we also consider 'from' from the previous state, we may get RangeErrors. So, let's make sure
    // our 'from'/'to' are within the document size. If not - do nothing for preserving the marks. Hopefully,
    // it won't lead to some case when I have some content without a font size mark
    if ((oldFrom >= 0 && oldFrom <= newContentSize) && (newTo >= 0 && newTo <= newContentSize)) {

      // Now, we need to see if we need to add attributes to the paragraph we are leaving in case it becomes
      // empty. We'll find the previous position of the cursor (from `oldState`), paragraph at that position,
      // calculate the marks we need to use there, build the paragraph attributes, and if they are not the same
      // as that paragraph has already - will apply them to the paragraph
      const fromPath = newState.doc.resolve(oldFrom).path;
      const fromNode = fromPath.filter(p => p && p.type && p.type.name === "paragraph")[0];

      if (fromNode != null) {
        const fromNodeMarks = buildActiveMarks(fromNode, action, oldState, newState);
        const fromNodeParagraphAttributes = buildParagraphAttrs(fromNode, fromNodeMarks);

        if (action.type === "transform" && !deepEqual(removeNulls(fromNode.attrs), fromNodeParagraphAttributes)) {
          actions.push((st) => st.tr.setBlockType(
            oldFrom, oldFrom, st.config.schema.nodes["paragraph"], fromNodeParagraphAttributes
          ).action());
        }
      }

      // Now, do the same for the paragraph we are moving to
      const toPath = newState.doc.resolve(newTo).path;
      const toNode = toPath.filter(p => p && p.type && p.type.name === "paragraph")[0];

      if (toNode != null) {
        const toNodeMarks = buildActiveMarks(toNode, action, oldState, newState);
        const toNodeParagraphAttributes = buildParagraphAttrs(toNode, toNodeMarks);

        if (action.type === "transform" && !deepEqual(removeNulls(toNode.attrs), toNodeParagraphAttributes)) {
          actions.push((st) => st.tr.setBlockType(
            newTo, newTo, newState.config.schema.nodes["paragraph"], toNodeParagraphAttributes
          ).action());
        }

        // In case our new paragraph is an empty one - add stored marks, so
        // we could start typing using the same style
        if (toNode.textContent === "") {
          toNodeMarks.forEach((mark) => {
            actions.push((st) => ({type: "addStoredMark", mark: mark}));
          });
        }

        // If it's a paste action, then we need to apply font size marks and/or paragraph attributes to the newly
        // pasted content
        if (isPaste(action)) {
          const size = action.transform.steps[0].slice.content.size;
          const from = oldState.selection.from;
          const to = Math.min(from + size, newContentSize);
          toNodeMarks.concat(oldState.storedMarks || []).forEach((mark) => {
            actions.push((st) => applyMarkToStateAction(from, to, mark, st));
            actions.push((st) => applyParagraphAttrsToStateAction(from, to, mark, st));
          });
        }
      }
    }

    // Now finally play all the actions to get the new state
    actions.forEach((actionCb) => {
      const action = actionCb(newState);
      action.addToHistory = false;
      newState = newState.applyAction(action);
    });

    return new TextEditor(this.defaultTextFormat, newState, this.revision + 1);
  }

  getTextFormat(range = null) {
    const state = this.editorState;
    // Use text selection range from ProseMirror state
    if (range == null) {
      range = [state.selection.from, state.selection.to];
    }

    if (range[0] === range[1]) {
      const marks = getMarks(range[0], range[1], state);
      const fontSizes = marks.filter(mark => mark.type === schema.marks["fontSize"]);

      let fontSize = fontSizes.length === 1 ? fontSizes[0].attrs.value : this.defaultTextFormat.fontSize;

      return new TextFormat(fontSize);
    } else {
      const fromFormat = this.getTextFormat([range[0], range[0]]);
      const toFormat = this.getTextFormat([range[1], range[1]]);

      return new TextFormat(
        fromFormat.fontSize === toFormat.fontSize ? fromFormat.fontSize : undefined
      )
    }
  }

  setTextFormat(format) {
    let result = this;
    let {from, to} = this.editorState.selection;

    if (format.fontSize != null) {
      result = result.applyFontSize(from, to, format.fontSize);
    }

    return result;
  }

  applyFontSize(from, to, size) {
    const mark = schema.mark("fontSize", {value: size});
    return this.applyMark(from, to, mark);
  }

  applyMark(from, to, mark) {
    let newState = applyMarkToState(from, to, mark, this.editorState);
    newState = applyParagraphAttrsToState(from, to, mark, newState);
    return new TextEditor(this.defaultTextFormat, newState, this.revision + 1);
  }

}

export class TextFormat {
  constructor(fontSize) {
    this.fontSize = fontSize;
  }

  static fromObject(obj) {
    return new TextFormat(obj.fontSize);
  }
}

function getMarks(from, to, state) {
  let marks = [];
  if (from === to) {
    marks = state.storedMarks || state.doc.marksAt(from);
  } else {
    state.doc.nodesBetween(from, to, node => {
      node.marks.forEach(mark => {
        marks = mark.addToSet(marks);
      })
    });
  }
  return marks;
}

function applyMarkToStateAction(from, to, mark, state) {
  if (from === to) {
    return {type: "addStoredMark", mark: mark};
  } else {
    let transform = state.tr;
    const marks = getMarks(from, to, state);
    // Clear out any marks of the same type that belong to this range. Otherwise, they won't get applied.
    if (mark.isInSet(marks)) {
      transform = transform.removeMark(from, to, mark);
    }
    transform = transform.addMark(from, to, mark);
    return transform.scrollAction();
  }
}

function applyMarkToState(from, to, mark, state) {
  return state.applyAction(applyMarkToStateAction(from, to, mark, state));
}

function applyParagraphAttrsToStateAction(from, to, mark, state) {
  let transform = state.tr;
  state.doc.nodesBetween(from, to, (node, pos, parent, index) => {
    if (node.type.name === "paragraph" && node.textContent === "") {
      const newAttrs = Object.assign({}, node.attrs, {[mark.type.name]: mark.attrs.value});
      transform = transform.setNodeType(pos, state.schema.nodes["paragraph"], newAttrs);
    }
  });
  return transform.scrollAction();
}

function applyParagraphAttrsToState(from, to, mark, state) {
  return state.applyAction(applyParagraphAttrsToStateAction(from, to, mark, state));
}

function buildParagraphAttrs(node, marks) {
  if (node && node.textContent === "") {
    return marks.reduce((memo, mark) => {
      if (mark && mark.attrs && mark.attrs.value) {
        memo[mark.type.name] = mark.attrs.value;
      }
      return memo;
    }, {});
  } else {
    return {};
  }
}

function buildActiveMarks(node, action, oldState, newState) {
  const oldFrom = oldState.selection.from;
  const newFrom = newState.selection.from;

  return (newState.storedMarks || [])
      .concat(
          action.type === "transform"
              ? oldState.doc.marksAt(oldFrom)
              : newState.doc.marksAt(newFrom))
      .concat(
          Object.keys(node.attrs)
              .filter(k => node.attrs[k] != null)
              .map(k => schema.mark(k, {value: node.attrs[k]})));
}

function buildKeymap() {
  let keys = {};

  function bind(key, cmd) {
    keys[key] = cmd;
  }

  bind("Mod-z", undo);
  bind("Mod-y", redo);
  return keys;
}

function deepEqual(x, y) {
  return (x && y && typeof x === 'object' && typeof y === 'object') ?
    (Object.keys(x).length === Object.keys(y).length) &&
    Object.keys(x).reduce(function(isEqual, key) {
      return isEqual && deepEqual(x[key], y[key]);
    }, true) : (x === y);
}

function removeNulls(x) {
  const y = {};
  Object.keys(x).forEach(k => {
    if (x[k] != null) {
      y[k] = x[k];
    }
  });
  return y;
}

// Is there a better way to know it was a paste action?
function isPaste(action) {
  try {
    const size = action.transform.steps[0].slice.content.size;
    const textContent = action.transform.steps[0].slice.content.content.map(c => c.textContent).join("");
    return action.type === "transform" && size > 1 && textContent !== "";
  } catch (e) {
    return false;
  }
}
