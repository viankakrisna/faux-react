let internalHookCursor = 0;
let internalStates = [];
let internalEffects = [];
let internalOldEffects = null;
let internalTree = new Map();
let internalLastTree = new Map();
let internalErrorComponent = null;
let internalErrorProps = null;
let internalErrorParent = null;
let internalRenderer = {};
let internalReactComponentKey = {};
let internalParent = null;

// START OF FAUX REACT
export function useRef(value) {
  return useState(() => ({ current: value }));
}

export function useMemo(expensive, deps) {
  const valueCursor = internalHookCursor++;
  const depsCursor = internalHookCursor++;

  const oldDeps = internalStates[depsCursor] || [];
  if (deps.some((dep, index) => dep !== oldDeps[index])) {
    internalStates[valueCursor] = expensive();
  }
  internalStates[depsCursor] = deps;

  const value = internalStates[valueCursor];
  return value;
}

export function useCallback(callback, deps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => callback, deps);
}

export function useState(initialState) {
  const stateCursor = internalHookCursor++;
  const callbackCursor = internalHookCursor++;
  if (internalStates[stateCursor] === undefined) {
    internalStates[stateCursor] =
      typeof initialState === "function" ? initialState() : initialState;
  }
  const currentState = internalStates[stateCursor];
  const updater =
    internalStates[callbackCursor] ||
    function stateUpdater(newState) {
      const currentState = internalStates[stateCursor];
      const updatedState =
        typeof newState === "function" ? newState(currentState) : newState;
      if (updatedState !== currentState) {
        internalStates[stateCursor] = updatedState;
        internalRenderer.update();
      }
    };
  return [currentState, updater];
}

export function useEffect(cb, dependencies) {
  internalEffects.push([cb, dependencies]);
}

export function useLayoutEffect(cb, dependencies) {
  internalEffects.push([cb, dependencies]);
}

export function useContext(context) {
  return context.currentValue;
}

export function Fragment(props) {
  return props.children;
}

export function createRef() {
  return { current: null };
}

export function createContext(currentValue) {
  const context = {
    currentValue,
    Provider({ value, children }) {
      if (value !== currentValue) {
        context.currentValue = value;
      }
      return children;
    }
  };
  return context;
}

export function createElement(type, props, ...children) {
  props = props || {};
  props.children = children.flat(Infinity);
  return {
    type,
    props
  };
}

export function Component(props) {
  this.props = props;
  this.setState = function setState(newState) {
    this.state = {
      ...newState
    };
  };
}

Component.prototype.reactComponentKey = internalReactComponentKey;

export function Suspense(...args) {
  this.state = {
    showFallback: false
  };
  Component.call(this, ...args);
}

Suspense.prototype = Object.create(Component.prototype);

Suspense.prototype.componentDidCatch = function componentDidCatch(thing) {
  this.setState({ showFallback: true });
  if (thing.then) {
    thing.then(() => {
      this.setState({ showFallback: false });
    });
  }
};

Suspense.prototype.render = function render() {
  return this.state.showFallback ? this.props.fallback : this.props.children;
};
// END OF FAUX REACT

// START OF FAUX REACT-DOM
export function render(rootElement, parent) {
  renderComponents(rootElement, parent);
  internalParent = parent;
  internalRenderer.render = render;
  internalRenderer.update = function updater() {
    setTimeout(() => {
      internalHookCursor = 0;
      if (internalLastTree) {
        internalLastTree.clear();
      }
      internalLastTree = internalTree;
      internalTree = new Map();
      renderComponents(rootElement, parent);
      removeUnusedDomNodes();
      runComponentEffects();
    });
  };
}

function renderComponents(element = null, parent = internalParent) {
  if (element === null) {
    return;
  }

  if (element === undefined) {
    throw new Error("Component is returning undefined");
  }

  if (["string", "number"].includes(typeof element)) {
    return commit(element, parent, createTextNode, updateTextNode);
  }

  if (typeof element.type === "string") {
    return commit(element, parent, createNode, updateNode);
  }

  if (typeof element.type === "function") {
    try {
      if (
        element.type.prototype.reactComponentKey === internalReactComponentKey
      ) {
        if (element.type.prototype.componentDidCatch) {
          internalErrorComponent = element.type;
          internalErrorProps = element.props;
          internalErrorParent = parent;
        }
        return renderComponents(
          renderClassComponent(element.type, element.props),
          parent
        );
      }
      return renderComponents(element.type(element.props), parent);
    } catch (error) {
      if (internalErrorComponent) {
        renderComponents(
          renderClassComponent(
            internalErrorComponent,
            internalErrorProps,
            error
          ),
          internalErrorParent
        );
      } else {
        console.error(error);
        throw error;
      }
    }
  }

  if (Array.isArray(element)) {
    element.forEach(el => renderComponents(el, parent));
  }
}

function renderClassComponent(Component, props, error) {
  const instanceCursor = internalHookCursor++;
  const instance = internalStates[instanceCursor] || new Component(props);
  if (error) {
    instance.componentDidCatch(error);
  }
  return instance.render();
}

function commit(element, parent, createNode, updateNode) {
  const lastFamily = internalLastTree.get(parent);
  let child = null;

  if (!internalTree.has(parent)) {
    internalTree.set(parent, new Set());
  }

  const family = internalTree.get(parent);

  if (lastFamily) {
    const lastFamilyArray = [...lastFamily];
    const lastChild = lastFamilyArray[family.size];
    if (lastChild) {
      child = updateNode(element, lastChild);
    } else {
      child = updateNode(element, createNode(element));
      parent.appendChild(child);
    }
  } else {
    child = updateNode(element, createNode(element));
    parent.appendChild(child);
  }
  family.add(child);

  if (element.props && element.props.children) {
    renderComponents(element.props.children, child);
  }
}

export function runComponentEffects() {
  internalStates.length = internalHookCursor;
  internalHookCursor = 0;

  if (!internalOldEffects) {
    internalEffects.forEach(([effect]) => {
      effect();
    });
  } else {
    internalEffects.forEach(([effect, dependencies], index) => {
      const oldEffect = internalOldEffects[index];
      const oldDeps = oldEffect[1] || [];
      if (
        dependencies.every(
          (dependency, dependencyIndex) =>
            dependency === oldDeps[dependencyIndex]
        )
      ) {
        return;
      }

      if (typeof oldEffect[0] === "function") {
        oldEffect[0]();
      }
      internalEffects[index][0] = effect();
    });
  }
  internalOldEffects = internalEffects;
  internalEffects = [];
}

function removeUnusedDomNodes() {
  for (const [parent, children] of internalLastTree) {
    if (internalTree.has(parent)) {
      for (const child of children) {
        if (!internalTree.get(parent).has(child)) {
          child.remove();
        }
      }
    } else {
      for (const child of children) {
        child.remove();
      }
    }
  }
}

function createTextNode(element) {
  return document.createTextNode(element);
}

function updateTextNode(element, node) {
  node.nodeValue = element;
  return node;
}

function createNode(element) {
  return document.createElement(element.type);
}

function updateNode(element, node) {
  if (node.nodeName.toLowerCase() !== element.type) {
    const newNode = document.createElement(element.type);
    node.parentElement.replaceChild(newNode, node);
    node = newNode;
  }
  const { children, style, ...props } = element.props;
  Object.assign(
    node,
    Object.fromEntries(
      Object.entries(props).map(([key, value]) => {
        if (key.startsWith("on")) {
          if (key === "onChange" && element.type === "input") {
            key = "oninput";
          }
          return [key.toLowerCase(), value];
        }
        return [key, value];
      })
    )
  );
  Object.assign(node.style || {}, style);
  return node;
}
// END OF FAUX REACT-DOM
