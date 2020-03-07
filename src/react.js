const React = {
  hookCursor: 0,
  states: [],
  effects: [],
  reactComponentKey: {},
  renderer() {
    throw new Error("Please include a valid renderer");
  },
  Component(props) {
    this.props = props;
    this.setState = function(newState) {
      this.state = {
        ...newState
      };
    };
  },
  runEffects() {
    React.states.length = React.hookCursor;
    React.hookCursor = 0;

    if (!React.oldEffects) {
      React.effects.forEach(([effect]) => {
        effect();
      });
    } else {
      React.effects.forEach(([effect, dependencies], index) => {
        const oldEffect = React.oldEffects[index];
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
        React.effects[index][0] = effect();
      });
    }
    React.oldEffects = React.effects;
    React.effects = [];
  },
  useRef(value) {
    return React.useState(() => ({ current: value }));
  },
  useMemo(expensive, deps) {
    const valueCursor = React.hookCursor++;
    const depsCursor = React.hookCursor++;

    const oldDeps = React.states[depsCursor] || [];
    if (deps.some((dep, index) => dep !== oldDeps[index])) {
      React.states[valueCursor] = expensive();
    }
    React.states[depsCursor] = deps;

    const value = React.states[valueCursor];
    return value;
  },
  useCallback(callback, deps) {
    return React.useMemo(() => callback, deps);
  },
  useState(initialState) {
    const stateCursor = React.hookCursor++;
    const callbackCursor = React.hookCursor++;
    if (React.states[stateCursor] === undefined) {
      React.states[stateCursor] =
        typeof initialState === "function" ? initialState() : initialState;
    }
    const currentState = React.states[stateCursor];
    const updater =
      React.states[callbackCursor] ||
      function stateUpdater(newState) {
        const currentState = React.states[stateCursor];
        const updatedState =
          typeof newState === "function" ? newState(currentState) : newState;
        if (updatedState !== currentState) {
          React.states[stateCursor] = updatedState;
          React.renderer.update();
        }
      };
    return [currentState, updater];
  },
  useEffect(cb, dependencies) {
    React.effects.push([cb, dependencies]);
  },
  useLayoutEffect(cb, dependencies) {
    React.effects.push([cb, dependencies]);
  },
  useContext(context) {
    return context.currentValue;
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
  createContext(currentValue) {
    const context = {
      currentValue,
      subscribers: new Set(),
      Provider({ value, children }) {
        if (value !== currentValue) {
          context.currentValue = value;
        }
        return children;
      }
    };
    return context;
  },
  isReactComponent(type) {
    if (React.Component === type.__proto__) {
      return true;
    }
    return false;
  },
  createElement(type, props, ...children) {
    props = props || {};
    props.children = children.flat(Infinity);
    return {
      type,
      instance: React.isReactComponent(type) ? new type(props) : null,
      props
    };
  }
};

React.Component.reactComponentKey = React.reactComponentKey;

export default React;
