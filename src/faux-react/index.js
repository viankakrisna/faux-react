import shared from "./shared";

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
