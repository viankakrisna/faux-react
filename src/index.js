import * as React from "./FauxReact";
import * as ReactDOM from "./FauxReactDom";

import App from "./App";

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
