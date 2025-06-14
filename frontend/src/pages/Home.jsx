import Chatbot from '../components/Chatbot.jsx';

const Home = () => (
  <div className="min-h-screen bg-gray-900 p-4 sm:p-6 lg:p-8">
    <div className="container mx-auto">
      <h1 className="text-3xl font-bold text-white mb-6 text-center sm:text-left">
        Welcome to the E-commerce Chatbot
      </h1>
      <Chatbot />
    </div>
  </div>
);

export default Home;