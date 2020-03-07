/* @jsx FauxReact.createElement */
import * as FauxReact from "./faux-react";
import App from "./App";

const rootElement = document.getElementById("root");
FauxReact.render(<App />, rootElement);
