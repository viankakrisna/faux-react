import react from "./react";

const renderer = {
  __tree: new Map(),
  __lastTree: new Map(),
  __renderClassComponent(Component, props, error) {
    const [instance] = react.useState(() => new Component(props));
    if (error) {
      instance.componentDidCatch(error);
    }
    return instance.render();
  },
  __flushOrphans() {
    for (const [parent, children] of renderer.__lastTree) {
      if (renderer.__tree.has(parent)) {
        for (const child of children) {
          if (!renderer.__tree.get(parent).has(child)) {
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
  __createTextNode(element) {
    return document.createTextNode(element);
  },
  __updateTextNode(element, node) {
    node.nodeValue = element;
    return node;
  },
  __createNode(element) {
    return document.createElement(element.type);
  },
  __updateNode: (element, node) => {
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
  },
  render(rootElement, parent) {
    renderer.__renderComponent(rootElement, parent);
    renderer.__update = function() {
      setTimeout(() => {
        react.__hookCursor = 0;
        if (renderer.__lastTree) {
          renderer.__lastTree.clear();
        }
        renderer.__lastTree = renderer.__tree;
        renderer.__tree = new Map();
        renderer.__renderComponent(rootElement, parent);
        renderer.__flushOrphans();
        react.__flushEffects();
      });
    };
  },
  __commit({ element, parent, createNode, updateNode }) {
    const lastFamily = renderer.__lastTree.get(parent);
    let child = null;

    if (!renderer.__tree.has(parent)) {
      renderer.__tree.set(parent, new Set());
    }

    const family = renderer.__tree.get(parent);

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
      renderer.__renderComponent(element.props.children, child);
    }
  },
  __renderComponent(element = null, parent = renderer.__parent) {
    if (element === null) {
      return;
    }

    if (element === undefined) {
      throw new Error("Component is returning undefined");
    }

    if (["string", "number"].includes(typeof element)) {
      return renderer.__commit({
        element,
        parent,
        createNode: renderer.__createTextNode,
        updateNode: renderer.__updateTextNode
      });
    }

    if (typeof element.type === "string") {
      renderer.__commit({
        element,
        parent,
        createNode: renderer.__createNode,
        updateNode: renderer.__updateNode
      });
      return;
    }

    if (typeof element.type === "function") {
      try {
        if (
          element.type.prototype.__reactComponentKey ===
          react.__reactComponentKey
        ) {
          if (element.type.prototype.componentDidCatch) {
            renderer.__errorComponent = element.type;
            renderer.__errorProps = element.props;
            renderer.__errorParent = parent;
          }
          return renderer.__renderComponent(
            renderer.__renderClassComponent(element.type, element.props),
            parent
          );
        }
        return renderer.__renderComponent(element.type(element.props), parent);
      } catch (error) {
        if (renderer.__errorComponent) {
          renderer.__renderComponent(
            renderer.__renderClassComponent(
              renderer.__errorComponent,
              renderer.__errorProps,
              error
            ),
            renderer.__errorParent
          );
        } else {
          throw error;
        }
      }
    }

    if (Array.isArray(element)) {
      element.forEach(el => renderer.__renderComponent(el, parent));
    }
  }
};

react.__renderer = renderer;

export default renderer;
