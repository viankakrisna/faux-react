const React = {
  __hookCursor: 0,
  __states: [],
  __effects: [],
  __reactComponentKey: {},
  __renderer() {
    throw new Error("Please include a valid renderer");
  },
  __flushEffects() {
    React.__states.length = React.__hookCursor;
    React.__hookCursor = 0;

    if (!React.__oldEffects) {
      React.__effects.forEach(([effect]) => {
        effect();
      });
    } else {
      React.__effects.forEach(([effect, dependencies], index) => {
        const oldEffect = React.__oldEffects[index];
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
        React.__effects[index][0] = effect();
      });
    }
    React.__oldEffects = React.__effects;
    React.__effects = [];
  },
  Component(props) {
    this.props = props;
    this.setState = function(newState) {
      this.state = {
        ...newState
      };
    };
  },
  useRef(value) {
    return React.useState(() => ({ current: value }));
  },
  useMemo(expensive, deps) {
    const valueCursor = React.__hookCursor++;
    const depsCursor = React.__hookCursor++;

    const oldDeps = React.__states[depsCursor] || [];
    if (deps.some((dep, index) => dep !== oldDeps[index])) {
      React.__states[valueCursor] = expensive();
    }
    React.__states[depsCursor] = deps;

    const value = React.__states[valueCursor];
    return value;
  },
  useCallback(callback, deps) {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return React.useMemo(() => callback, deps);
  },
  useState(initialState) {
    const stateCursor = React.__hookCursor++;
    const callbackCursor = React.__hookCursor++;
    if (React.__states[stateCursor] === undefined) {
      React.__states[stateCursor] =
        typeof initialState === "function" ? initialState() : initialState;
    }
    const currentState = React.__states[stateCursor];
    const updater =
      React.__states[callbackCursor] ||
      function stateUpdater(newState) {
        const currentState = React.__states[stateCursor];
        const updatedState =
          typeof newState === "function" ? newState(currentState) : newState;
        if (updatedState !== currentState) {
          React.__states[stateCursor] = updatedState;
          React.__renderer.__update();
        }
      };
    return [currentState, updater];
  },
  useEffect(cb, dependencies) {
    React.__effects.push([cb, dependencies]);
  },
  useLayoutEffect(cb, dependencies) {
    React.__effects.push([cb, dependencies]);
  },
  useContext(context) {
    return context.__currentValue;
  },
  Suspense(props) {
    return props.children;
  },
  Fragment(props) {
    return props.children;
  },
  createRef() {
    return { current: null };
  },
  createContext(__currentValue) {
    const context = {
      __currentValue,
      Provider({ value, children }) {
        if (value !== __currentValue) {
          context.__currentValue = value;
        }
        return children;
      }
    };
    return context;
  },
  createElement(type, props, ...children) {
    props = props || {};
    props.children = children.flat(Infinity);
    return {
      type,
      props
    };
  }
};

React.Component.prototype.__reactComponentKey = React.__reactComponentKey;

React.Suspense = function Suspense(...args) {
  this.state = {
    showFallback: false
  };
  React.Component.call(this, ...args);
};

React.Suspense.prototype = Object.create(React.Component.prototype);

React.Suspense.prototype.componentDidCatch = function componentDidCatch(thing) {
  this.setState({ showFallback: true });
  if (thing.then) {
    thing.then(() => {
      this.setState({ showFallback: false });
    });
  }
};

React.Suspense.prototype.render = function render() {
  return this.state.showFallback ? this.props.fallback : this.props.children;
};

export default React;
