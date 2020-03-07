import react from "./react";

const renderer = {
  rendered: null,
  tree: new Map(),
  lastTree: new Map(),
  primitives: ["number", "string", "symbol"],
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
  render(rootElement, parent) {
    renderer.renderComponent(rootElement, parent);
    renderer.update = function() {
      react.hookCursor = 0;
      renderer.lastTree = renderer.tree;
      renderer.tree = new Map();
      renderer.renderComponent(rootElement, parent);
      renderer.flushOrphans();
      react.runEffects();
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
        createNode: () => document.createTextNode(element),
        updateNode: dom => {
          dom.nodeValue = element;
          return dom;
        }
      });
    }

    if (typeof element.type === "string") {
      renderer.commit({
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
      try {
        if (element.type.prototype.componentDidCatch) {
          renderer.errorComponent = element.type;
          renderer.errorProps = element.props;
          renderer.errorParent = parent;
        }
        if (element.type.reactComponentKey === react.reactComponentKey) {
          return renderer.renderComponent(
            renderer.renderClassComponent(element.type, element.props),
            parent
          );
        }
        return renderer.renderComponent(element.type(element.props), parent);
      } catch (error) {
        renderer.renderComponent(
          renderer.renderClassComponent(
            renderer.errorComponent,
            renderer.errorProps,
            error
          ),
          renderer.errorParent
        );
      }
    }

    if (Array.isArray(element)) {
      element.forEach(el => renderer.renderComponent(el, parent));
    }
  }
};

react.renderer = renderer;

export default renderer;
