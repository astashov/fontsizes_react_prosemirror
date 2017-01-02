import * as React from "react";
import {TextEditor} from "../model/text_editor";
import {TextEditorView} from "./text_editor";
import {TextEditorControlsView} from "./text_editor_controls";

export class App extends React.Component {
  constructor(props) {
    super(props);
    //const result = location.search.replace(/^\?/, "").split("&").map(a => a.split("=")).filter(f => f[0] === "str");
    //const str = result.length > 0 ? result[0][1] : "";
    const str = document.querySelector(".str");
    this.state = {
      textEditor: TextEditor.create(str),
      fontSizes: [10, 12, 14, 18, 24, 28, 32]
    };
  }

  render() {
    return (
      <div>
        <TextEditorControlsView fonts={this.state.fonts} fontSizes={this.state.fontSizes}
                                textEditor={this.state.textEditor}
                                onUpdate={this.updateTextEditorState.bind(this)}/>
        <hr/>
        <TextEditorView textEditor={this.state.textEditor} onUpdate={this.updateTextEditorState.bind(this)}/>
      </div>
    )
  }

  updateTextEditorState(state) {
    this.setState({textEditor: state});
  }
}