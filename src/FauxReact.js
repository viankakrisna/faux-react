let hookCursor = 0;
let states = [];
let effects = [];
let oldEffects = null;
let renderer = {};

export const reactComponentKey = {};

export function setRendererOptions(options) {
  renderer.current = options.renderer;
}

export function flushEffects() {
  states.length = hookCursor;
  hookCursor = 0;

  if (!oldEffects) {
    effects.forEach(([effect]) => {
      effect();
    });
  } else {
    effects.forEach(([effect, dependencies], index) => {
      const oldEffect = oldEffects[index];
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
      effects[index][0] = effect();
    });
  }
  oldEffects = effects;
  effects = [];
}

export function useRef(value) {
  return useState(() => ({ current: value }));
}

export function useMemo(expensive, deps) {
  const valueCursor = hookCursor++;
  const depsCursor = hookCursor++;

  const oldDeps = states[depsCursor] || [];
  if (deps.some((dep, index) => dep !== oldDeps[index])) {
    states[valueCursor] = expensive();
  }
  states[depsCursor] = deps;

  const value = states[valueCursor];
  return value;
}

export function useCallback(callback, deps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => callback, deps);
}

export function useState(initialState) {
  const stateCursor = hookCursor++;
  const callbackCursor = hookCursor++;
  if (states[stateCursor] === undefined) {
    states[stateCursor] =
      typeof initialState === "function" ? initialState() : initialState;
  }
  const currentState = states[stateCursor];
  const updater =
    states[callbackCursor] ||
    function stateUpdater(newState) {
      const currentState = states[stateCursor];
      const updatedState =
        typeof newState === "function" ? newState(currentState) : newState;
      if (updatedState !== currentState) {
        states[stateCursor] = updatedState;
        renderer.current.update();
      }
    };
  return [currentState, updater];
}

export function useEffect(cb, dependencies) {
  effects.push([cb, dependencies]);
}

export function useLayoutEffect(cb, dependencies) {
  effects.push([cb, dependencies]);
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

Component.prototype.reactComponentKey = reactComponentKey;

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
