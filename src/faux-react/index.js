import sharedState from "./state";

export function useRef(value) {
  return useState(() => ({ current: value }));
}

export function useMemo(expensive, deps) {
  const valueCursor = sharedState.hookCursor++;
  const depsCursor = sharedState.hookCursor++;

  const oldDeps = sharedState.states[depsCursor] || [];
  if (deps.some((dep, index) => dep !== oldDeps[index])) {
    sharedState.states[valueCursor] = expensive();
  }
  sharedState.states[depsCursor] = deps;

  const value = sharedState.states[valueCursor];
  return value;
}

export function useCallback(callback, deps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => callback, deps);
}

export function useState(initialState) {
  const stateCursor = sharedState.hookCursor++;
  const callbackCursor = sharedState.hookCursor++;
  if (sharedState.states[stateCursor] === undefined) {
    sharedState.states[stateCursor] =
      typeof initialState === "function" ? initialState() : initialState;
  }
  const currentState = sharedState.states[stateCursor];
  const updater =
    sharedState.states[callbackCursor] ||
    function stateUpdater(newState) {
      const currentState = sharedState.states[stateCursor];
      const updatedState =
        typeof newState === "function" ? newState(currentState) : newState;
      if (updatedState !== currentState) {
        sharedState.states[stateCursor] = updatedState;
        sharedState.renderer.update();
      }
    };
  return [currentState, updater];
}

export function useEffect(cb, dependencies) {
  sharedState.effects.push([cb, dependencies]);
}

export function useLayoutEffect(cb, dependencies) {
  sharedState.effects.push([cb, dependencies]);
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

Component.prototype.reactComponentKey = sharedState.reactComponentKey;

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
