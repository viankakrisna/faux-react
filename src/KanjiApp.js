import * as React from "./faux-react";
import { useState, useEffect, useCallback, useMemo } from "./faux-react";

import "./styles.css";

function callIfFunction(value) {
  return typeof value === "function" ? value() : value;
}

function usePersistentState(key, initialState) {
  const [state, setState] = useState(() => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value === null ? callIfFunction(initialState) : value;
    } catch (error) {
      return callIfFunction(initialState);
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [state, key]);
  return [state, setState];
}

function usePromise(promise = () => Promise.resolve()) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    promise().then(setResult);
  }, [promise]);
  return [result];
}

function useFetchCallback(...args) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(() => fetch(...args).then(res => res.json()), args);
}

function useFetch(...args) {
  return usePromise(useFetchCallback(...args));
}

const isClient = typeof window === "object";

function getSize() {
  return {
    width: isClient ? window.innerWidth : undefined,
    height: isClient ? window.innerHeight : undefined
  };
}

function useWindowSize() {
  const [windowSize, setWindowSize] = useState(getSize);

  useEffect(() => {
    if (!isClient) {
      return false;
    }

    function handleResize() {
      setWindowSize(getSize());
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowSize;
}

function ObjectTable({ style, ...object }) {
  return (
    <table style={style}>
      <tbody>
        {Object.keys(object).map(key =>
          !object[key] ? null : (
            <tr key={key}>
              <td>{key}</td>
              <td>
                {object[key] && typeof object[key] === "object" ? (
                  Array.isArray(object[key]) ? (
                    object[key].join(", ")
                  ) : (
                    <ObjectTable {...object[key]} />
                  )
                ) : (
                  object[key]
                )}
              </td>
            </tr>
          )
        )}
      </tbody>
    </table>
  );
}

function Button({ style, ...props }) {
  return (
    <button
      {...props}
      style={{
        fontSize: "inherit",
        letterSpacing: "0.25em",
        textTransform: "uppercase",
        padding: "0.5em",
        background: "indigo",
        border: "none",
        color: "white",
        fontWeight: "bold",
        cursor: "pointer",
        ...style
      }}
    />
  );
}

const Kanji = ({ data, style, next }) => {
  const size = useWindowSize();

  if (!data) {
    return null;
  }
  const isPortrait = size.height > size.width;
  return (
    <div style={style}>
      <div
        style={{
          display: "flex",
          flexDirection: isPortrait ? "column" : "row",
          alignItems: "center",
          height: "100vh"
        }}
      >
        <div style={{ fontSize: "50vmin", flex: 1, textAlign: "center" }}>
          {data[0]}
        </div>
        <ObjectTable {...data[1]} style={{ flex: 1, margin: "auto" }} />
        <Button
          style={{
            display: "block",
            position: "fixed",
            width: "100%",
            bottom: 0,
            left: 0,
            right: 0
          }}
          onClick={() => next()}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

function getRandomInteger(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function pluralize(text, value) {
  if (value && value.length > 1) {
    return text + "s";
  }
  return text;
}

export default function App() {
  const [result] = useFetch(
    "https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json"
  );

  const [jlpt, setJLPT] = usePersistentState("jlpt", 5);
  const data = useMemo(
    () =>
      result
        ? Object.entries(result)
            .filter(([key, value]) => value.jlpt_new === jlpt)
            .map(([key, value]) => [
              key,
              {
                [`On ${pluralize(
                  "Reading",
                  value.readings_on
                )}`]: value.readings_on,
                [`Kun ${pluralize(
                  "Reading",
                  value.readings_kun
                )}`]: value.readings_kun,
                [pluralize("Meaning", value.meanings)]: value.meanings,
                [pluralize("Radical", value.wk_radicals)]: value.wk_radicals
              }
            ])
        : [],
    [result, jlpt]
  );
  const getRandomData = useCallback(
    () => getRandomInteger(0, data ? data.length : 0),
    [data]
  );
  const [index, setIndex] = useState(getRandomData);
  useEffect(() => {
    setIndex(getRandomData);
  }, [getRandomData]);
  if (!result) {
    return null;
  }
  return (
    <>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0 }}>
        <label>JLPT N</label>
        <input
          type="number"
          min="1"
          max="5"
          style={{ padding: 0, fontSize: "inherit" }}
          value={jlpt}
          onChange={e => {
            if (e.target.value < 1 || e.target.value > 5) {
              return;
            }
            setJLPT(Number(e.target.value));
          }}
        />
      </div>
      <Kanji data={data[index]} next={() => setIndex(getRandomData)} />
    </>
  );
}
