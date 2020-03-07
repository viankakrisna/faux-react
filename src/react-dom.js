import react from "./react";

const renderer = {
  rendered: null,
  tree: new Map(),
  lastTree: new Map(),
  primitives: ["number", "string", "symbol"],
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
  render(rootElement, parent) {
    renderer.commit(rootElement, parent);
    renderer.update = function() {
      react.hookCursor = 0;
      renderer.lastTree = renderer.tree;
      renderer.tree = new Map();
      renderer.commit(rootElement, parent);
      renderer.flushOrphans();
    };
  },
  renderElement({ element, parent, createNode, updateNode }) {
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
        child = updateNode(lastChild);
      } else {
        child = updateNode(createNode());
        parent.appendChild(child);
      }
    } else {
      child = updateNode(createNode());
      parent.appendChild(child);
    }
    family.add(child);

    if (element.props && element.props.children) {
      renderer.commit(element.props.children, child);
    }
  },
  commit(element = null, parent = renderer.parent) {
    if (element === null) {
      return;
    }

    if (element === undefined) {
      throw new Error("Component is returning undefined");
    }

    if (["string", "number"].includes(typeof element)) {
      return renderer.renderElement({
        element,
        parent,
        createNode: () => document.createTextNode(element),
        updateNode: dom => {
          dom.nodeValue = element;
          return dom;
        }
      });
    }

    if (typeof element.type === "string") {
      renderer.renderElement({
        element,
        parent,
        createNode: () => document.createElement(element.type),
        updateNode: node => {
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
          Object.assign(node.style, style);
          return node;
        }
      });
      return;
    }

    if (typeof element.type === "function") {
      return renderer.commit(element.type(element.props), parent);
    }

    if (Array.isArray(element)) {
      element.forEach(el => renderer.commit(el, parent));
    }
  }
};

react.renderer = renderer;

export default renderer;
