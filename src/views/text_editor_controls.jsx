import * as React from "react";
import {TextFormat} from "../model/text_editor";

export function TextEditorControlsView({textEditor, onUpdate, fontSizes}) {
  const currentTextFormat = textEditor.getTextFormat();
  return <div>
    <select value={currentTextFormat.fontSize} onChange={handleFontSizeChange(textEditor, onUpdate)}>
      {fontSizes.map((size, i) => <option key={i} value={size}>{size}</option>)}
    </select>
  </div>
}

const handleFontSizeChange = handleSelectChange(size => ({fontSize: size}));

function handleSelectChange(textFormatFunc) {
  return (textEditor, onUpdate) => (event) => {
    const format = TextFormat.fromObject(textFormatFunc(event.target.value));
    onUpdate(textEditor.setTextFormat(format));
  }
}