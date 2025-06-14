import { useState, useEffect } from 'react';
import axios from '../utils/api';

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cart, setCart] = useState([]);

  // Get suggestions as user types
  useEffect(() => {
    const getSuggestions = async () => {
      if (input.trim().length > 2) {
        try {
          const res = await axios.get('/products/search', {
            params: { query: input, limit: 5 },
          });
          const responseData = res.data.success ? res.data.data : res.data;
          setSuggestions(Array.isArray(responseData) ? responseData.slice(0, 5) : []);
          setShowSuggestions(true);
        } catch (error) {
          console.error('Error getting suggestions:', error);
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };

    const timeoutId = setTimeout(getSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [input]);

  const handleSuggestionClick = (product) => {
    setInput(product.name);
    setShowSuggestions(false);
    handleSend(product.name);
  };

  const addToCart = (product) => {
    const existingItem = cart.find(item => item._id === product._id);
    
    if (existingItem) {
      setCart(cart.map(item => 
        item._id === product._id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }

    // Show success message
    const successMessage = {
      text: `✅ ${product.name} has been added to your cart!`,
      sender: 'bot',
      timestamp: new Date(),
      type: 'success'
    };
    
    setMessages(prevMessages => [...prevMessages, successMessage]);

    // Save to backend cart if user is authenticated
    saveToBackendCart(product);
  };

  const saveToBackendCart = async (product) => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        await axios.post('/cart/add', {
          productId: product._id,
          quantity: 1
        });
      } catch (error) {
        console.error('Error saving to backend cart:', error);
      }
    }
  };

  const ProductCard = ({ product }) => (
    <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 mb-3 max-w-sm">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-white font-semibold text-lg truncate pr-2">{product.name}</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          product.inStock 
            ? 'bg-green-600 text-green-100' 
            : 'bg-red-600 text-red-100'
        }`}>
          {product.inStock ? 'In Stock' : 'Out of Stock'}
        </span>
      </div>
      
      <p className="text-gray-300 text-sm mb-3 line-clamp-3">
        {product.description || 'No description available'}
      </p>
      
      <div className="flex justify-between items-center mb-3">
        <span className="text-indigo-400 font-bold text-xl">
          ${product.price ? product.price.toFixed(2) : '0.00'}
        </span>
        {product.category && (
          <span className="bg-gray-600 text-gray-300 px-2 py-1 rounded text-xs">
            {product.category}
          </span>
        )}
      </div>
      
      <button
        onClick={() => addToCart(product)}
        disabled={!product.inStock}
        className={`w-full py-2 px-4 rounded font-medium transition-colors ${
          product.inStock
            ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
        }`}
      >
        {product.inStock ? '🛒 Add to Cart' : 'Out of Stock'}
      </button>
    </div>
  );

  const handleSend = async (searchQuery = null) => {
    const query = searchQuery || input;
    if (!query.trim()) return;
    
    const userMessage = { text: query, sender: 'user', timestamp: new Date() };
    
    // Add user message immediately
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setShowSuggestions(false);

    try {
      // Search for products
      const res = await axios.get('/products/search', {
        params: { query: query },
      });
      
      // Handle response format
      const responseData = res.data.success ? res.data.data : res.data;
      const products = Array.isArray(responseData) ? responseData : [];
      
      if (products.length > 0) {
        // Add text response
        const textResponse = {
          text: `Found ${products.length} product${products.length > 1 ? 's' : ''} matching "${query}":`,
          sender: 'bot',
          timestamp: new Date(),
        };
        
        setMessages(prevMessages => [...prevMessages, textResponse]);
        
        // Add product cards
        products.forEach(product => {
          const productMessage = {
            sender: 'bot',
            timestamp: new Date(),
            type: 'product',
            product: product
          };
          
          setMessages(prevMessages => [...prevMessages, productMessage]);
        });
      } else {
        const noResultsMessage = {
          text: `Sorry, no products found for "${query}". Try searching for different keywords.`,
          sender: 'bot',
          timestamp: new Date(),
        };
        
        setMessages(prevMessages => [...prevMessages, noResultsMessage]);
      }

      // Save chat to backend
      const token = localStorage.getItem('token');
      if (token) {
        try {
          await axios.post('/chat', {
            message: query,
            response: products.length > 0 
              ? `Found ${products.length} products for "${query}"`
              : `No products found for "${query}"`,
          });
        } catch (saveError) {
          console.error('Error saving chat:', saveError);
        }
      }
      
    } catch (error) {
      console.error('Error:', error);
      
      let errorMessage = 'Sorry, something went wrong while searching for products.';
      
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        errorMessage = 'Cannot connect to server. Please make sure your backend is running on port 6000.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Product search service not available. Please try again later.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Please login to search for products.';
      } else if (error.response?.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      const errorResponse = {
        text: errorMessage,
        sender: 'bot',
        timestamp: new Date(),
        type: 'error'
      };
      
      setMessages(prevMessages => [...prevMessages, errorResponse]);
    }
    
    if (!searchQuery) {
      setInput('');
    }
  };

  const getCartCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  return (
    <div className="flex flex-col h-96 max-w-2xl mx-auto bg-gray-800 rounded-lg overflow-hidden relative">
      {/* Header with cart info */}
      <div className="bg-gray-700 px-4 py-3 border-b border-gray-600">
        <div className="flex justify-between items-center">
          <h3 className="text-white font-semibold">Product Search</h3>
          <div className="flex items-center space-x-2">
            <span className="text-gray-300 text-sm">Cart: {getCartCount()} items</span>
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-green-400 text-xs">Online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <p className="mb-2">👋 Welcome! Search for products by typing below.</p>
            <p className="text-sm">Try searching for "laptop", "phone", or any product name.</p>
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div key={index}>
            {msg.type === 'product' ? (
              <div className="flex justify-start">
                <ProductCard product={msg.product} />
              </div>
            ) : (
              <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs p-3 rounded-lg ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white'
                    : msg.type === 'success'
                    ? 'bg-green-600 text-white'
                    : msg.type === 'error'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-600 text-white'
                }`}>
                  <div>{msg.text}</div>
                  <div className="text-xs opacity-70 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Input area */}
      <div className="p-4 border-t border-gray-600 relative">
        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 bg-gray-700 border border-gray-600 rounded-lg shadow-lg mb-2 max-h-40 overflow-y-auto">
            {suggestions.map((product, index) => (
              <div
                key={index}
                onClick={() => handleSuggestionClick(product)}
                className="p-3 hover:bg-gray-600 cursor-pointer border-b border-gray-600 last:border-b-0"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-white text-sm font-medium">{product.name}</div>
                    <div className="text-gray-400 text-xs">${product.price?.toFixed(2)}</div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs ${
                    product.inStock ? 'bg-green-600 text-green-100' : 'bg-red-600 text-red-100'
                  }`}>
                    {product.inStock ? 'In Stock' : 'Out of Stock'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 p-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
            placeholder="Search for products... (e.g., laptop, phone, shoes)"
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            onFocus={() => input.length > 2 && setShowSuggestions(true)}
          />
          <button
            onClick={() => handleSend()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          >
            🔍
          </button>
        </div>
        
        <div className="flex space-x-2 mt-2">
          <button
            onClick={() => setMessages([])}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
          >
            🗑️ Clear Chat
          </button>
          <button
            onClick={() => {
              alert(`Cart Contents:\n${cart.map(item => `${item.name} (x${item.quantity}) - $${(item.price * item.quantity).toFixed(2)}`).join('\n')}\n\nTotal: $${cart.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2)}`);
            }}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
          >
            🛒 View Cart ({getCartCount()})
          </button>
        </div>
        
        {/* Connection status */}
        <div className="mt-2 text-xs text-gray-400 text-center">
          Backend: http://localhost:5000 | Cart: {getCartCount()} items
        </div>
      </div>
    </div>
  );
};

export default Chatbot;