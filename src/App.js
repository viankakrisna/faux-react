import * as React from "./faux-react";
import "./styles.css";

function Button(props) {
  return (
    <button
      {...props}
      style={{
        ...props.style
      }}
    >
      {props.children}
    </button>
  );
}

function Todo() {
  const [text, setText] = React.useState("");
  const [todos, setTodos] = React.useState([]);
  React.useEffect(() => {
    console.log({ todos });
  }, [todos]);
  return (
    <>
      <form
        onSubmit={e => {
          e.preventDefault();
          if (text) {
            setText("");
            setTodos(todos.concat(text));
          }
        }}
      >
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
        />
      </form>
      <ul>
        {todos.map((todo, index) => (
          <li style={{ display: "flex" }}>
            <div style={{ flex: 1 }}>{todo}</div>
            <Button
              onClick={() => {
                setTodos(
                  todos.filter((__, currentIndex) => index !== currentIndex)
                );
              }}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}

const CounterContext = React.createContext([0, () => {}]);

function Counter() {
  const [counter, setCounter] = React.useContext(CounterContext);
  return (
    <>
      <h1> {counter}</h1>
      <Button onClick={e => setCounter(counter + 1)}>Increment</Button>
      <Button onClick={e => setCounter(counter - 1)}>Decrement</Button>
    </>
  );
}

class ErrorBoundary extends React.Component {
  state = {};
  componentDidCatch(error) {
    this.setState({ error });
  }
  render() {
    return (
      <div>
        {this.state.error ? (
          <pre style={{ backgroundColor: "red", padding: "1em" }}>
            {this.props.fallback(this.state.error)}
          </pre>
        ) : (
          this.props.children
        )}
      </div>
    );
  }
}

function ErrorComponent() {
  throw new Error("This is an error");
}

export default function App() {
  const [counter, setCounter] = React.useState(0);

  return (
    <>
      <CounterContext.Provider value={[counter, setCounter]}>
        <div className="App" style={{ textAlign: "center" }}>
          <Counter />
          <Todo />
          <ErrorBoundary fallback={error => error.message}>
            <div>
              <ErrorComponent />
            </div>
          </ErrorBoundary>
          <React.Suspense fallback="Loading">
            <PromisedComponent />
          </React.Suspense>
        </div>
      </CounterContext.Provider>
    </>
  );
}

function PromisedComponent() {
  const [result, setResult] = React.useState(null);
  if (!result) {
    throw new Promise(resolve => setTimeout(resolve, 3000)).then(() =>
      setResult("Resolved")
    );
  }
  return <div>{result}</div>;
}
