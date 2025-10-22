import HomePage from "../src/pages/HomePage"
import { Route, Routes } from 'react-router-dom'
import Footer from "./components/Footer";


function App() {
  return (
    <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
        <Footer/>
    </div>
  );
}

export default App;
