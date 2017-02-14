// import {nodes} from "prosemirror-schema-basic";
import {Schema} from "prosemirror-model";
import {marks} from "prosemirror-schema-basic";

export const schema = new Schema({
  nodes: {
    doc: {content: "paragraph+"},
    // Paragraphs define, serialize, and parse an extra attribute
    // `marks`, which is used to store the active set of marks for
    // empty paragraph.
    paragraph: {
      content: "inline<_>*",
      attrs: {marks: {default: null}},
      parseDOM: [{
        tag: "p",
        getAttrs(dom) {
          const marks = dom.getAttribute("data-marks");
          return marks ? {marks: JSON.parse(marks)} : null;
        }
      }],
      toDOM(node) {
        const marks = node.attrs.marks;
        const size = marks && marks.size;
        return ["p", {
          style: size ? `font-size: ${size.size}pt` : null,
          "data-marks": marks ? JSON.stringify(marks) : null
        }, 0];
      }
    },
    text: {
      group: "inline",
      toDOM(node) {
        return ["span", {class: "text"}, node.text];
      }
    }
  },
  marks: {
    strong: marks.strong,
    em: marks.em,
    // Simple size mark, based on the examples in our emails.
    size: {
      attrs: {size: {}},
      parseDOM: [{
        tag: "s[font-size]",
        getAttrs(dom) {
          const size = +dom.getAttribute("font-size");
          if (!isNaN(size)) {
            return {size: size};
          }
        }
      }],
      toDOM(node) {
        return ["s", {"font-size": node.attrs.size, style: `font-size: ${node.attrs.size}pt`}];
      }
    }
  }
});
