const shared = {
  hookCursor: 0,
  states: [],
  effects: [],
  oldEffects: null,
  tree: new Map(),
  lastTree: new Map(),
  errorComponent: null,
  errorProps: null,
  errorParent: null,
  renderer: {},
  reactComponentKey: {}
};

// START OF FAUX REACT
export function useRef(value) {
  return useState(() => ({ current: value }));
}

export function useMemo(expensive, deps) {
  const valueCursor = shared.hookCursor++;
  const depsCursor = shared.hookCursor++;

  const oldDeps = shared.states[depsCursor] || [];
  if (deps.some((dep, index) => dep !== oldDeps[index])) {
    shared.states[valueCursor] = expensive();
  }
  shared.states[depsCursor] = deps;

  const value = shared.states[valueCursor];
  return value;
}

export function useCallback(callback, deps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => callback, deps);
}

export function useState(initialState) {
  const stateCursor = shared.hookCursor++;
  const callbackCursor = shared.hookCursor++;
  if (shared.states[stateCursor] === undefined) {
    shared.states[stateCursor] =
      typeof initialState === "function" ? initialState() : initialState;
  }
  const currentState = shared.states[stateCursor];
  const updater =
    shared.states[callbackCursor] ||
    function stateUpdater(newState) {
      const currentState = shared.states[stateCursor];
      const updatedState =
        typeof newState === "function" ? newState(currentState) : newState;
      if (updatedState !== currentState) {
        shared.states[stateCursor] = updatedState;
        shared.renderer.update();
      }
    };
  return [currentState, updater];
}

export function useEffect(cb, dependencies) {
  shared.effects.push([cb, dependencies]);
}

export function useLayoutEffect(cb, dependencies) {
  shared.effects.push([cb, dependencies]);
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

Component.prototype.reactComponentKey = shared.reactComponentKey;

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
  shared.parent = parent;
  shared.renderer.render = render;
  shared.renderer.update = function updater() {
    setTimeout(() => {
      shared.hookCursor = 0;
      if (shared.lastTree) {
        shared.lastTree.clear();
      }
      shared.lastTree = shared.tree;
      shared.tree = new Map();
      renderComponents(rootElement, parent);
      removeUnusedDomNodes();
      runComponentEffects();
    });
  };
}

function renderComponents(element = null, parent = shared.parent) {
  if (element === null) {
    return;
  }

  if (element === undefined) {
    throw new Error("Component is returning undefined");
  }

  if (["string", "number"].includes(typeof element)) {
    return commit({
      element,
      parent,
      createNode: createTextNode,
      updateNode: updateTextNode
    });
  }

  if (typeof element.type === "string") {
    return commit({
      element,
      parent,
      createNode: createNode,
      updateNode: updateNode
    });
  }

  if (typeof element.type === "function") {
    try {
      if (
        element.type.prototype &&
        element.type.prototype.reactComponentKey === shared.reactComponentKey
      ) {
        if (element.type.prototype.componentDidCatch) {
          shared.errorComponent = element.type;
          shared.errorProps = element.props;
          shared.errorParent = parent;
        }
        return renderComponents(
          renderClassComponent(element.type, element.props),
          parent
        );
      }
      return renderComponents(element.type(element.props), parent);
    } catch (error) {
      if (shared.errorComponent) {
        renderComponents(
          renderClassComponent(shared.errorComponent, shared.errorProps, error),
          shared.errorParent
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
  const instanceCursor = shared.hookCursor++;
  const instance = shared[instanceCursor] || new Component(props);
  if (error) {
    instance.componentDidCatch(error);
  }
  return instance.render();
}

function commit({ element, parent, createNode, updateNode }) {
  const lastFamily = shared.lastTree.get(parent);
  let child = null;

  if (!shared.tree.has(parent)) {
    shared.tree.set(parent, new Set());
  }

  const family = shared.tree.get(parent);

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
  shared.states.length = shared.hookCursor;
  shared.hookCursor = 0;

  if (!shared.oldEffects) {
    shared.effects.forEach(([effect]) => {
      effect();
    });
  } else {
    shared.effects.forEach(([effect, dependencies], index) => {
      const oldEffect = shared.oldEffects[index];
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
      shared.effects[index][0] = effect();
    });
  }
  shared.oldEffects = shared.effects;
  shared.effects = [];
}

function removeUnusedDomNodes() {
  for (const [parent, children] of shared.lastTree) {
    if (shared.tree.has(parent)) {
      for (const child of children) {
        if (!shared.tree.get(parent).has(child)) {
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
