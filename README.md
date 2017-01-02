# ProseMirror + Font Sizes + React Demo

Link: https://s3.amazonaws.com/mixbook_dev/dart/test_prosemirror_react/current/index.html

Demo using ProseMirror with variable font sizes inside a controlled React component.

ProseMirror is contained within a controlled React component called `TextEditorView` and is
initialized on the `componentDidMount` lifecycle event.

The state for the `TextEditorView` and its containing ProseMirror view is represented by the 
`TextEditor` model. This model contains a reference to the current ProseMirror state, as well 
as utility methods for transforming the ProseMirror state.

A new version of the model is passed back from the `TextEditorView` via the `onUpdate` callback
whenever the state of the ProseMirror view changes.

## Running

* Clone the project
* Run `npm install`
* run `npm run build` || `npm run watch`
* Run `npm run serve`
* Run `open http://localhost:8080`
