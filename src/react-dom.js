import react from "./react";

const renderer = {
  tree: new Map(),
  lastTree: new Map(),
  renderClassComponent(Component, props, error) {
    const [instance] = react.useState(() => new Component(props));
    if (error) {
      instance.componentDidCatch(error);
    }
    return instance.render();
  },
  flushOrphans() {
    for (const [parent, children] of renderer.lastTree) {
      if (renderer.tree.has(parent)) {
        for (const child of children) {
          if (!renderer.tree.get(parent).has(child)) {
            child.remove();
          }
        }
      } else {
        for (const child of children) {
          child.remove();
        }
      }
    }
  },
  createTextNode(element) {
    return document.createTextNode(element);
  },
  updateTextNode(element, node) {
    node.nodeValue = element;
    return node;
  },
  createNode(element) {
    return document.createElement(element.type);
  },
  updateNode: (element, node) => {
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
            return [key.toLowerCase(), value];
          }
          return [key, value];
        })
      )
    );
    Object.assign(node.style || {}, style);
    return node;
  },
  render(rootElement, parent) {
    renderer.renderComponent(rootElement, parent);
    renderer.update = function() {
      setTimeout(() => {
        react.hookCursor = 0;
        if (renderer.lastTreee) {
          renderer.lastTree.clear();
        }
        renderer.lastTree = renderer.tree;
        renderer.tree = new Map();
        renderer.renderComponent(rootElement, parent);
        renderer.flushOrphans();
        react.flushEffects();
      });
    };
  },
  commit({ element, parent, createNode, updateNode }) {
    const lastFamily = renderer.lastTree.get(parent);
    let child = null;

    if (!renderer.tree.has(parent)) {
      renderer.tree.set(parent, new Set());
    }

    const family = renderer.tree.get(parent);

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
      renderer.renderComponent(element.props.children, child);
    }
  },
  renderComponent(element = null, parent = renderer.parent) {
    if (element === null) {
      return;
    }

    if (element === undefined) {
      throw new Error("Component is returning undefined");
    }

    if (["string", "number"].includes(typeof element)) {
      return renderer.commit({
        element,
        parent,
        createNode: renderer.createTextNode,
        updateNode: renderer.updateTextNode
      });
    }

    if (typeof element.type === "string") {
      renderer.commit({
        element,
        parent,
        createNode: renderer.createNode,
        updateNode: renderer.updateNode
      });
      return;
    }

    if (typeof element.type === "function") {
      try {
        if (element.type.reactComponentKey === react.reactComponentKey) {
          if (element.type.prototype.componentDidCatch) {
            renderer.errorComponent = element.type;
            renderer.errorProps = element.props;
            renderer.errorParent = parent;
          }
          return renderer.renderComponent(
            renderer.renderClassComponent(element.type, element.props),
            parent
          );
        }
        return renderer.renderComponent(element.type(element.props), parent);
      } catch (error) {
        if (renderer.errorComponent) {
          renderer.renderComponent(
            renderer.renderClassComponent(
              renderer.errorComponent,
              renderer.errorProps,
              error
            ),
            renderer.errorParent
          );
        } else {
          throw error;
        }
      }
    }

    if (Array.isArray(element)) {
      element.forEach(el => renderer.renderComponent(el, parent));
    }
  }
};

react.renderer = renderer;

export default renderer;
