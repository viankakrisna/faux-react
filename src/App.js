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

function ListItem({ children, index, onClick }) {
  React.useEffect(() => {
    console.log(`List Item ${index} mounted`);
    return () => {
      console.log(`List Item ${index} unmounted`);
    };
  }, [index]);
  const [isCompleted, setIsCompleted] = React.useState(false);
  return (
    <li
      style={{
        display: "flex",
        textDecoration: isCompleted ? "line-through" : null
      }}
    >
      <div style={{ flex: 1 }}>{children}</div>
      <Button onClick={onClick}>Delete</Button>
      <Button onClick={() => setIsCompleted(!isCompleted)}>Complete</Button>
    </li>
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
          <ListItem
            key={todo}
            index={index}
            onClick={() => {
              setTodos(
                todos.filter((__, currentIndex) => index !== currentIndex)
              );
            }}
          >
            {todo}
          </ListItem>
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
  React.useEffect(() => {
    console.log("useEffect: App is mounted");
  }, []);
  return (
    <>
      <CounterContext.Provider value={[counter, setCounter]}>
        <div className="App" style={{ textAlign: "center" }}>
          <Counter />
          <Todo />
          <ErrorBoundary fallback={error => error.message}>
            <ErrorComponent />
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
