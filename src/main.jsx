import * as React from "react";
import * as ReactDom from "react-dom";
import {App} from "./views/app";

export function main(container) {
  ReactDom.render(<App/>, container);
}
