import React from "./react";
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
          onInput={e => setText(e.target.value)}
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

// class ErrorBoundary extends React.Component {
//   state = {};
//   componentDidCatch(error) {
//     console.log("caught an error");
//     this.setState({ error });
//   }
//   render() {
//     return (
//       <div>
//         {this.state.error
//           ? this.props.fallback(this.state.error)
//           : this.props.children}
//       </div>
//     );
//   }
// }

export default function App() {
  const [counter, setCounter] = React.useState(0);

  return (
    <>
      <CounterContext.Provider value={[counter, setCounter]}>
        <div className="App" style={{ textAlign: "center" }}>
          <Counter />
          <Todo />
        </div>
      </CounterContext.Provider>
    </>
  );
}
