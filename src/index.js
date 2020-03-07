import * as React from "./faux-react";
import * as ReactDOM from "./faux-react/dom";

import App from "./App";

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);
