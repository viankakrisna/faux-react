import sharedState from "./state";

function renderClassComponent(Component, props, error) {
  const instanceCursor = sharedState.hookCursor++;
  const instance = sharedState[instanceCursor] || new Component(props);
  if (error) {
    instance.componentDidCatch(error);
  }
  return instance.render();
}

function flushOrphans() {
  for (const [parent, children] of sharedState.lastTree) {
    if (sharedState.tree.has(parent)) {
      for (const child of children) {
        if (!sharedState.tree.get(parent).has(child)) {
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
  console.log(element);
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

export function render(rootElement, parent) {
  renderComponent(rootElement, parent);
  sharedState.parent = parent;
  sharedState.renderer.render = render;
  sharedState.renderer.update = function() {
    setTimeout(() => {
      sharedState.hookCursor = 0;
      if (sharedState.lastTree) {
        sharedState.lastTree.clear();
      }
      sharedState.lastTree = sharedState.tree;
      sharedState.tree = new Map();
      renderComponent(rootElement, parent);
      flushOrphans();
      flushEffects();
    });
  };
}

function commit({ element, parent, createNode, updateNode }) {
  const lastFamily = sharedState.lastTree.get(parent);
  let child = null;

  if (!sharedState.tree.has(parent)) {
    sharedState.tree.set(parent, new Set());
  }

  const family = sharedState.tree.get(parent);

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
    renderComponent(element.props.children, child);
  }
}

function renderComponent(element = null, parent = sharedState.parent) {
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
        element.type.prototype.reactComponentKey ===
        sharedState.reactComponentKey
      ) {
        if (element.type.prototype.componentDidCatch) {
          sharedState.errorComponent = element.type;
          sharedState.errorProps = element.props;
          sharedState.errorParent = parent;
        }
        return renderComponent(
          renderClassComponent(element.type, element.props),
          parent
        );
      }
      return renderComponent(element.type(element.props), parent);
    } catch (error) {
      if (sharedState.errorComponent) {
        renderComponent(
          renderClassComponent(
            sharedState.errorComponent,
            sharedState.errorProps,
            error
          ),
          sharedState.errorParent
        );
      } else {
        // throw error;
      }
    }
  }

  if (Array.isArray(element)) {
    element.forEach(el => renderComponent(el, parent));
  }
}

export function flushEffects() {
  sharedState.states.length = sharedState.hookCursor;
  sharedState.hookCursor = 0;

  if (!sharedState.oldEffects) {
    sharedState.effects.forEach(([effect]) => {
      effect();
    });
  } else {
    sharedState.effects.forEach(([effect, dependencies], index) => {
      const oldEffect = sharedState.oldEffects[index];
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
      sharedState.effects[index][0] = effect();
    });
  }
  sharedState.oldEffects = sharedState.effects;
  sharedState.effects = [];
}
