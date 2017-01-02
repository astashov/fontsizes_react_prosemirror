import * as React from "react";
import {EditorView} from "prosemirror-view";

export class TextEditorView extends React.Component {
  componentDidMount() {
    this.textEditor = this.props.textEditor;
    this.view = new EditorView(this.refs["text-editor"], {
      state: this.textEditor.editorState,
      attributes: {spellcheck: false},
      onAction: action => {
        this.textEditor = this.textEditor.applyAction(action);
        if (typeof this.props.onUpdate === "function") {
          this.props.onUpdate(this.textEditor);
        }
        this.view.updateState(this.textEditor.editorState);
      }
    });
    this.view.focus();
  }

  componentDidUpdate() {
    if (this.props.textEditor.revision > this.textEditor.revision) {
      this.textEditor = this.props.textEditor;
      this.view.updateState(this.textEditor.editorState);
      this.view.focus();
    }
  }

  render() {
    return <div className="text-editor" ref="text-editor"></div>;
  }
}