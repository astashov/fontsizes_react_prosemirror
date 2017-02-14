import {DOMParser} from "prosemirror-model";
import {EditorState} from "prosemirror-state";
import {baseKeymap} from "prosemirror-commands";
import {keymap} from "prosemirror-keymap";
import {schema} from "../schema";
import {history, undo, redo} from "prosemirror-history";
import {preserveMarksPlugin} from "../preserve_marks_plugin";

export class TextEditor {
  constructor(defaultTextFormat, editorState, revision) {
    // Our default font size, basically. Type is - `TextFormat`.
    this.defaultTextFormat = defaultTextFormat;
    // ProseMirror's Editor State
    this.editorState = editorState;
    // This `revision` integer is to make it work in React/Redux environment. It seems like since ProseMirror 0.15 we
    // can't just send the ProseMirror state to reducers, handle it there, then return to the view and rerender
    // the view with the updated state, because now there's some rendering happens in place, and if you type
    // fast enough, the state could be corrupted. Instead, we now update the view right in `dispatchTransaction`, and send the
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
            preserveMarksPlugin({styleEmpty: ["paragraph"]}),
            keymap(baseKeymap),
            keymap(buildKeymap()),
            history()]});

    return new TextEditor(defaultTextFormat, editorState, 0);
  }

  applyTransaction(transaction) {
    const newState = this.editorState.apply(transaction);
    return new TextEditor(this.defaultTextFormat, newState, this.revision + 1);
  }

  getTextFormat() {
    const marks = this.editorState.storedMarks
        || (this.editorState.selection.$head || this.editorState.selection.$from).marks();
    const size = schema.marks.size.isInSet(marks);
    if (size) {
      return new TextFormat(size.attrs.size);
    } else {
      return new TextFormat(this.defaultTextFormat.fontSize);
    }
  }

  setTextFormat(format) {
    const type = schema.marks.size;
    let state = this.editorState;
    let newState;
    const value = format.fontSize;
    const {from, to} = state.selection;
    if (from === to) {
      const marks = state.storedMarks || state.selection.$head.marks();
      const exists = type.isInSet(marks);
      if (!exists || exists.attrs.size != +value) {
        newState = state.apply(state.tr.addStoredMark(type.create({size: +value})));
      }
    } else {
      newState = state.apply(state.tr.addMark(from, to, type.create({size: +value})).scrollIntoView());
    }
    if (newState) {
      return new TextEditor(this.defaultTextFormat, newState, this.revision + 1);
    } else {
      return this;
    }
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

function buildKeymap() {
  let keys = {};

  function bind(key, cmd) {
    keys[key] = cmd;
  }

  bind("Mod-z", undo);
  bind("Mod-y", redo);
  return keys;
}
