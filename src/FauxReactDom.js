import * as FauxReact from "./FauxReact";

let tree = new Map();
let lastTree = new Map();
let errorComponent;
let errorProps;
let errorParent;

const renderer = {};

function renderClassComponent(Component, props, error) {
  const [instance] = FauxReact.useState(() => new Component(props));
  if (error) {
    instance.componentDidCatch(error);
  }
  return instance.render();
}

function flushOrphans() {
  for (const [parent, children] of lastTree) {
    if (tree.has(parent)) {
      for (const child of children) {
        if (!tree.get(parent).has(child)) {
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

export function render(rootElement, parent) {
  renderComponent(rootElement, parent);
  renderer.render = render;
  renderer.update = function() {
    setTimeout(() => {
      FauxReact.hookCursor = 0;
      if (lastTree) {
        lastTree.clear();
      }
      lastTree = tree;
      tree = new Map();
      renderComponent(rootElement, parent);
      flushOrphans();
      FauxReact.flushEffects();
    });
  };
}

function commit({ element, parent, createNode, updateNode }) {
  const lastFamily = lastTree.get(parent);
  let child = null;

  if (!tree.has(parent)) {
    tree.set(parent, new Set());
  }

  const family = tree.get(parent);

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

function renderComponent(element = null, parent) {
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
    commit({
      element,
      parent,
      createNode: createNode,
      updateNode: updateNode
    });
    return;
  }

  if (typeof element.type === "function") {
    try {
      if (
        element.type.prototype.reactComponentKey === FauxReact.reactComponentKey
      ) {
        if (element.type.prototype.componentDidCatch) {
          errorComponent = element.type;
          errorProps = element.props;
          errorParent = parent;
        }
        return renderComponent(
          renderClassComponent(element.type, element.props),
          parent
        );
      }
      return renderComponent(element.type(element.props), parent);
    } catch (error) {
      if (errorComponent) {
        renderComponent(
          renderClassComponent(errorComponent, errorProps, error),
          errorParent
        );
      } else {
        throw error;
      }
    }
  }

  if (Array.isArray(element)) {
    element.forEach(el => renderComponent(el, parent));
  }
}

FauxReact.setRendererOptions({
  renderer
});
