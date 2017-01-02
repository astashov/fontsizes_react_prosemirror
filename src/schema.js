// import {nodes} from "prosemirror-schema-basic";
import {Schema} from "prosemirror-model";

const nodes = {
  doc: {
    content: "block+"
  },
  paragraph: {
    group: "block",
    attrs: {
      "fontSize": {default: null},
    },
    content: "inline<_>*",
    toDOM: (node) => {
      let style = "";
      if (node.attrs["fontSize"] != null) {
        style += `font-size: ${node.attrs["fontSize"]}px`;
      }
      return ["p", {style: style}, 0];
    },
    parseDOM: [{
      tag: "p",
      getAttrs: (dom) => {
        return {
          "fontSize": dom.getAttribute("font-size"),
        };
      },
      text: null,
      preserveWhitespace: true
    }]
  },
  text: {
    group: "inline",
    toDOM: (node) => node.text,
  }
};

const marks = {
  fontSize: {
    attrs: {
      value: {default: null}
    },
    parseDOM: [{
      getAttrs(dom) {
        const fontSize = dom.getAttribute("font-size");
        return {value: fontSize};
      },
      tag: "s"
    }],
    toDOM(node) {
      const fontSize = node.attrs["value"];
      return ["s", {style: `font-size: ${fontSize}`}];
    }
  }
};

export const schema = new Schema({
  nodes: nodes,
  marks: marks
});