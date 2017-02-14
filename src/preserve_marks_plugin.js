import {Mark, DOMSerializer} from "prosemirror-model";
import {Plugin} from "prosemirror-state";
import {splitBlock} from "prosemirror-commands";

// Because attribute values must be JSON-serializable, these simplify
// and desimplify an array of marks to an object mapping mark names to
// attribute sets.
function flattenMarks(marks) {
  const result = {};
  for (let i = 0; i < marks.length; i++) {
    result[marks[i].type.name] = marks[i].attrs;
  }
  return result;
}

function unflattenMarks(schema, marks) {
  const result = [];
  for (let mark in marks) {
    result.push(schema.marks[mark].create(marks[mark]));
  }
  return result;
}

// This plugin does several things:
//
// - When the selection is moved into an empty paragraph that has
//   marks associated with it, it sets the stored marks to those
//   marks
//
// - When an empty paragraph is typed into, it clears the
//   paragraph's `marks` attribute
//
// - When a non-empty paragraph is made empty, it sets that
//   paragraph's `marks` attribute to the marks of the deleted text,
//   if any
//
// It also registers
export function preserveMarksPlugin(options = {}) {
  let nodeViews = {};
  (options.styleEmpty || ["paragraph"]).forEach(name => {
    nodeViews[name] = styleEmpty;
  });

  return new Plugin({
    appendTransaction: (trs, _, newState) => {
      // console.log("");
      // console.log("Start transaction");
      const setAt = [];
      const setMarks = [];

      function add($old, $new) {
        if (!isEmptyTextblock($old) && isEmptyTextblock($new)) {
          // console.log("old is not, new is empty");
          setAt.push($new.pos - 1);
          setMarks.push(flattenMarks($old.marks(true)));
        } else if (isEmptyTextblock($old) && !isEmptyTextblock($new)) {
          // console.log("old is empty, new is not");
          setAt.push($old.pos - 1);
          setMarks.push(null);
        }
        // console.log("setAt", setAt);
        // console.log("setMark", setMarks);
      }

      // Iterate over the transactions and their step maps
      trs.forEach(tr => {
        tr.mapping.maps.forEach((map, i) => {
          let arr = [];
          map.forEach((oldStart, oldEnd, newStart, newEnd) => {
            arr.push([oldStart, oldEnd, newStart, newEnd]);
          });
          // console.log("Map", JSON.stringify(arr));
          // Map previously stored positions forward
          for (let j = 0; j < setAt.length; j++) {
            const newPos = map.mapResult(setAt[j]);
            if (newPos.deleted) {
              // console.log("New Pos deleted");
              setAt.splice(j, 1);
              setMarks.splice(j, 1);
              j = j - 1;
            } else {
              // console.log("New Pos not deleted");
              setAt[j] = newPos.pos;
            }
          }

          const oldDoc = tr.docs[i];
          const newDoc = tr.docs[i + 1] || tr.doc;
          // For each modified region, see if it is a relevant deletion or
          // insertion.
          map.forEach((oldStart, oldEnd, newStart, newEnd) => {
            let $newStart = newDoc.resolve(newStart);
            // console.log("Handling start");
            add(oldDoc.resolve(oldStart), $newStart);
            if (newEnd > $newStart.end()) {
              // console.log("Handling end");
              add(oldDoc.resolve(oldEnd), newDoc.resolve(newEnd));
            }
          });
        });
      });

      const {empty, $head} = newState.selection;

      // See if the selection is in an empty textblock and if that block
      // has marks stored.
      const inEmpty = empty && $head.parent.isTextblock && $head.parent.content.size == 0;
      let storeMarks = inEmpty
        && $head.parent.attrs.marks
        && unflattenMarks(newState.schema, $head.parent.attrs.marks);

      // Bail out if we don't need to change anything
      if (setAt.length == 0 && (!storeMarks || (newState.storedMarks && Mark.sameSet(storeMarks, newState.storedMarks)))) {
        return null;
      }

      // Generate a transaction that adds the attributes and set the stored marks
      let appendTR = newState.tr;

      for (let i = 0; i < setAt.length; i++) {
        const $pos = appendTR.doc.resolve(setAt[i] + 1);
        const marks = setMarks[i];
        if (marks && isEmptyTextblock($pos) && !$pos.parent.attrs.marks) {
          // console.log("Set Node Type", marks);
          appendTR.setNodeType(setAt[i], null, {marks: marks});
          if (inEmpty && $pos.pos == $head.pos) {
            storeMarks = unflattenMarks(newState.schema, marks);
          }
        } else if (!marks && !isEmptyTextblock($pos) && $pos.parent.attrs.marks) {
          // console.log("Set Node Type", null);
          appendTR.setNodeType(setAt[i], null, {marks: null});
        }
      }
      if (storeMarks && !appendTR.storedMarks) {
        // console.log("Set Stored Marks", storeMarks);
        appendTR.setStoredMarks(storeMarks);
      }
      return appendTR;
    },

    props: {
      nodeViews: nodeViews,
      handleKeyDown: (view, event) => {
        if (event.keyCode != 13) {
          return false;
        }
        return splitParagraph(view.state, view.dispatch);
      }
    }
  })
}

// Custom node view that adds an 'empty' CSS class to a node when it
// is empty.
function styleEmpty(node) {
  const {dom, contentDOM} = DOMSerializer.renderSpec(document, node.type.spec.toDOM(node));
  let empty = node.content.size === 0;
  if (empty) {
    dom.classList.add("empty");
  }
  return {
    dom: dom,
    contentDOM: contentDOM,
    update: (newNode) => {
      if (!node.sameMarkup(newNode)) {
        return false;
      }
      if (empty !== (node.content.size === 0)) {
        empty = !empty;
        if (empty) {
          dom.classList.add("empty");
        } else {
          dom.classList.remove("empty");
        }
      }
      return true;
    }
  }
}

function isEmptyTextblock($pos) {
  return $pos.parent.isTextblock && $pos.parent.content.size == 0;
}

// A command that calls `splitBlock` but follows up by storing
// marks from the old text in the new paragraph, if it is empty.
function splitParagraph(state, dispatch) {
  return splitBlock(state, dispatch && (tr => {
      // console.log("Split block");
      let marks = state.storedMarks;
      const $to = state.selection.$to;
      if (!marks && $to.parentOffset) {
        marks = state.selection.$from.marks();
      }
      if (marks) {
        if ($to.parentOffset < $to.parent.content.size) {
          // console.log("Set stored marks");
          tr.setStoredMarks(marks);
        } else {
          // console.log("Set node type");
          tr.setNodeType($to.pos + 1, null, {marks: flattenMarks(marks)});
        }
      }
      dispatch(tr);
    }));
}
