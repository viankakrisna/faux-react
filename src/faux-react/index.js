let _hookCursor = 0;
let _hooks = [];
let _effects = [];
let _oldEffects = null;
let _tree = new Map();
let _lastTree = new Map();
let _errorComponent = null;
let _errorProps = null;
let _errorParent = null;
let _renderer = {};
let _reactComponentKey = {};
let _parent = null;
let _currentComponent = 0;
let _componentHooksMap = new Map();

// START OF FAUX REACT
export function useRef(value) {
  return useState(() => ({ current: value }));
}

export function useMemo(expensive, deps) {
  const valueCursor = _hookCursor++;
  const depsCursor = _hookCursor++;

  const oldDeps = _hooks[depsCursor] || [];
  if (deps.some((dep, index) => dep !== oldDeps[index])) {
    _hooks[valueCursor] = expensive();
  }
  _hooks[depsCursor] = deps;

  const value = _hooks[valueCursor];
  return value;
}

function getComponentInstance(element) {
  if (element.props.key) {
    return element.props.key;
  }
  return element.type;
}

export function useCallback(callback, deps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => callback, deps);
}

export function useState(initialState) {
  const stateCursor = _hookCursor++;
  const callbackCursor = _hookCursor++;
  const component = _currentComponent;
  if (_hooks[stateCursor] === undefined) {
    _hooks[stateCursor] =
      typeof initialState === "function" ? initialState() : initialState;
  }
  const currentState = _hooks[stateCursor];
  const updater =
    _hooks[callbackCursor] ||
    function stateUpdater(newState) {
      _currentComponent = component;
      _hooks = _componentHooksMap.get(_currentComponent);
      const currentState = _hooks[stateCursor];
      const updatedState =
        typeof newState === "function" ? newState(currentState) : newState;
      if (updatedState !== currentState) {
        _hooks[stateCursor] = updatedState;
        _renderer.update();
      }
    };
  return [currentState, updater];
}

export function useEffect(cb, dependencies) {
  _effects.push([cb, dependencies]);
}

export function useLayoutEffect(cb, dependencies) {
  _effects.push([cb, dependencies]);
}

export function useContext(context) {
  return context._currentValue;
}

export function Fragment(props) {
  return props.children;
}

export function createRef() {
  return { current: null };
}

export function createContext(_currentValue) {
  const context = {
    _currentValue,
    Provider({ value, children }) {
      if (value !== _currentValue) {
        context._currentValue = value;
      }
      return children;
    }
  };
  return context;
}

let id = 0;
export function createElement(type, props, ...children) {
  props = props || {};
  props.children = children.flat(Infinity);
  return {
    instance: id++,
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

Component.prototype.reactComponentKey = _reactComponentKey;

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
  _parent = parent;
  _renderer.render = render;
  _hookCursor = 0;

  renderComponents(rootElement, parent);
  runComponentEffects();

  _renderer.update = function updater() {
    _hookCursor = 0;

    if (_lastTree) {
      _lastTree.clear();
    }
    _lastTree = _tree;
    _tree = new Map();
    renderComponents(rootElement, parent);
    removeUnusedDomNodes();
    runComponentEffects();
  };
}

function renderComponents(element = null, parent = _parent) {
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
    _currentComponent = getComponentInstance(element);
    if (!_componentHooksMap.has(_currentComponent)) {
      _componentHooksMap.set(_currentComponent, []);
    }

    _hooks = _componentHooksMap.get(_currentComponent);

    try {
      if (
        element.type.prototype &&
        element.type.prototype.reactComponentKey === _reactComponentKey
      ) {
        if (element.type.prototype.componentDidCatch) {
          _errorComponent = element.type;
          _errorProps = element.props;
          _errorParent = parent;
        }
        return renderComponents(
          renderClassComponent(element.type, element.props),
          parent
        );
      }
      return renderComponents(element.type(element.props), parent);
    } catch (error) {
      if (_errorComponent) {
        renderComponents(
          renderClassComponent(_errorComponent, _errorProps, error),
          _errorParent
        );
      } else {
        console.error(error);
        throw error;
      }
    } finally {
      _currentComponent = null;
      _hooks = null;
    }
  }

  if (Array.isArray(element)) {
    for (const el of element) {
      renderComponents(el, parent);
    }
  }
}

function renderClassComponent(Component, props, error) {
  const instanceCursor = _hookCursor++;
  const instance = _hooks[instanceCursor] || new Component(props);
  if (error) {
    instance.componentDidCatch(error);
  }
  return instance.render();
}

function commit(element, parent, createNode, updateNode) {
  const lastFamily = _lastTree.get(parent);
  let child = null;

  if (!_tree.has(parent)) {
    _tree.set(parent, new Set());
  }

  const family = _tree.get(parent);

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
  id = 0;
  if (!_oldEffects) {
    for (const [effect] of _effects) {
      effect();
    }
  } else {
    let index = 0;
    for (const currentEffect of _effects) {
      const [effect, dependencies] = currentEffect;
      const oldEffect = _oldEffects[index] || [];
      index++;

      const oldDeps = oldEffect[1] || [];
      if (
        dependencies.every(
          (dependency, dependencyIndex) =>
            dependency === oldDeps[dependencyIndex]
        )
      ) {
        currentEffect[0] = null;
        continue;
      }

      if (typeof oldEffect[0] === "function") {
        oldEffect[0]();
      }
      currentEffect[0] = effect();
    }
  }
  _oldEffects = _effects;
  _effects = [];
}

function removeUnusedDomNodes() {
  for (const [parent, children] of _lastTree) {
    if (_tree.has(parent)) {
      for (const child of children) {
        if (!_tree.get(parent).has(child)) {
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
