import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import { apiFetch, setToken } from './utils/api';

function App() {
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Extra feature: Expense history
  const [expenseHistory, setExpenseHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Fetch friends when user logs in
  useEffect(() => {
    if (user) {
      fetchFriends();
    }
  }, [user]);

  // Fetch history when a friend is selected
  useEffect(() => {
    if (selectedFriend) {
      fetchHistory(selectedFriend.id);
    } else {
      setExpenseHistory([]);
    }
  }, [selectedFriend]);

  async function fetchFriends() {
    setIsLoading(true);
    try {
      const data = await apiFetch('/api/friends');
      setFriends(data);
    } catch (err) {
      console.error('Failed to fetch friends', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchHistory(friendshipId) {
    setIsLoadingHistory(true);
    try {
      const data = await apiFetch(`/api/friends/${friendshipId}/expenses`);
      setExpenseHistory(data);
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  function handleLogout() {
    setUser(null);
    setToken(null);
    setFriends([]);
    setSelectedFriend(null);
  }

  function handleShowAddFriend() {
    setShowAddFriend((show) => !show);
  }

  async function handleAddFriend(newFriendData) {
    try {
      const newFriend = await apiFetch('/api/friends', {
        method: 'POST',
        body: JSON.stringify(newFriendData),
      });
      setFriends((friends) => [...friends, newFriend]);
      setShowAddFriend(false);
    } catch (err) {
      console.error('Failed to add friend', err);
    }
  }

  function handleSelection(friend) {
    setSelectedFriend((curr) => (curr?.id === friend.id ? null : friend));
    setShowAddFriend(false);
  }

  async function handleSplitBill(value, paidByOption) {
    try {
      await apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          friendshipId: selectedFriend.id,
          description: 'Split Bill',
          totalAmount: value.total,
          myShare: value.myShare,
          paidBy: paidByOption
        }),
      });
      // Refresh friends to update balance, and refresh history
      await fetchFriends();
      await fetchHistory(selectedFriend.id);
      
      // Keep friend selected so they can see history update
      // setSelectedFriend(null);
    } catch (err) {
      console.error('Failed to split bill', err);
    }
  }

  async function handleSettleUp() {
    if (!selectedFriend || selectedFriend.balance === 0) return;
    
    // If balance > 0, friend owes me, so friend pays me to settle.
    // If balance < 0, I owe friend, so I pay friend to settle.
    const paidByOption = selectedFriend.balance > 0 ? 'friend' : 'user';
    const amountToSettle = Math.abs(selectedFriend.balance);

    try {
      await apiFetch(`/api/expenses/${selectedFriend.id}/settle`, {
        method: 'POST',
        body: JSON.stringify({
          amountToSettle,
          paidBy: paidByOption
        })
      });
      await fetchFriends();
      await fetchHistory(selectedFriend.id);
    } catch (err) {
      console.error('Failed to settle up', err);
    }
  }

  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  return (
    <div>
      <div style={{ textAlign: 'right', padding: '1rem' }}>
        Logged in as <strong>{user.name}</strong> 
        <button onClick={handleLogout} style={{ marginLeft: '1rem', cursor: 'pointer' }}>Logout</button>
      </div>
      <div className='app'>
        <div className='sidebar'>
          {isLoading ? (
            <p>Loading friends...</p>
          ) : (
            <FriendsList
              friends={friends}
              selectedFriend={selectedFriend}
              onSelection={handleSelection}
            />
          )}

          {showAddFriend && <FormAddFriend onAddFriend={handleAddFriend} />}

          <Button onClick={handleShowAddFriend}>
            {showAddFriend ? 'Close' : 'Add Friend'}
          </Button>
        </div>

        {selectedFriend && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <FormSplitBill
              selectedFriend={selectedFriend}
              onSplitBill={handleSplitBill}
              key={selectedFriend.id}
            />
            
            <div className="history-panel" style={{ backgroundColor: '#fdf2e9', padding: '3.2rem 4rem', borderRadius: '7px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>History with {selectedFriend.name}</h2>
                {selectedFriend.balance !== 0 && (
                  <Button onClick={handleSettleUp}>Settle Up ({Math.abs(selectedFriend.balance)}€)</Button>
                )}
              </div>
              
              {isLoadingHistory ? <p>Loading history...</p> : (
                <ul style={{ listStyle: 'none', padding: 0, marginTop: '2rem' }}>
                  {expenseHistory.map(exp => (
                    <li key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', borderBottom: '1px solid #ffe8cc' }}>
                      <span>{exp.description} ({new Date(exp.created_at).toLocaleDateString()})</span>
                      <span>
                        Total: {exp.total_amount}€ | Paid by: {exp.paid_by === user.id ? 'You' : selectedFriend.name}
                      </span>
                    </li>
                  ))}
                  {expenseHistory.length === 0 && <p>No expense history yet.</p>}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

function Button({ children, onClick }) {
  return (
    <button className='button' onClick={onClick}>
      {children}
    </button>
  );
}

function FriendsList({ friends, selectedFriend, onSelection }) {
  return (
    <ul>
      {friends.map((friend) => (
        <Friend
          friend={friend}
          selectedFriend={selectedFriend}
          onSelection={onSelection}
          key={friend.id}
        />
      ))}
    </ul>
  );
}

function Friend({ friend, selectedFriend, onSelection }) {
  const isSelected = selectedFriend?.id === friend.id;
  return (
    <li className={isSelected ? 'selected' : ''}>
      <img src={friend.image} alt={friend.name} />
      <h3> {friend.name} </h3>
      {friend.balance < 0 && (
        <p className='red'>
          You owe {friend.name} {Math.abs(friend.balance)}€
        </p>
      )}
      {friend.balance > 0 && (
        <p className='green'>
          {friend.name} owes You {friend.balance}€
        </p>
      )}
      {friend.balance === 0 && <p>You and {friend.name} are even</p>}
      <Button onClick={() => onSelection(friend)}>
        {isSelected ? 'Close' : 'Select'}
      </Button>
    </li>
  );
}

function FormAddFriend({ onAddFriend }) {
  const [name, setName] = useState('');
  const [image, setImage] = useState(`https://i.pravatar.cc/48?u=${crypto.randomUUID()}`);

  function handleSubmit(e) {
    e.preventDefault();
    if (!name || !image) return;

    onAddFriend({ name, image });
    setName('');
    setImage(`https://i.pravatar.cc/48?u=${crypto.randomUUID()}`);
  }
  return (
    <form className='form-add-friend' onSubmit={handleSubmit}>
      <label>👨‍🎨Friendname</label>
      <input
        type='text'
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label>📷Image URL</label>
      <input
        type='text'
        value={image}
        onChange={(e) => setImage(e.target.value)}
      />
      <Button>Add</Button>
    </form>
  );
}

function FormSplitBill({ selectedFriend, onSplitBill }) {
  const [bill, setBill] = useState('');
  const [paidByUser, setPaidByUser] = useState('');
  const paidByFriend = bill ? bill - paidByUser : '';
  const [whoIsPaying, setWhoIsPaying] = useState('user');

  function handleSubmit(e) {
    e.preventDefault();
    if (!bill || !paidByUser) return;
    
    // Instead of computing final balance here, we send raw data to API
    onSplitBill({
      total: bill,
      myShare: paidByUser // Actually wait, in original it was simple: user and friend.
      // If user pays, their "share" of the expense is `paidByUser`. The rest is the friend's.
      // If the bill is 100, user paid 100. user's share is 40. Friend owes 60.
    }, whoIsPaying);

    setBill('');
    setPaidByUser('');
    setWhoIsPaying('user');
  }

  return (
    <form className='form-split-bill' onSubmit={handleSubmit}>
      <h2>Split a bill with {selectedFriend.name} </h2>

      <label>💰 Bill value</label>
      <input
        type='number'
        value={bill}
        onChange={(e) => setBill(Number(e.target.value))}
      />

      <label>🙎‍♂️ Your expense</label>
      <input
        type='number'
        value={paidByUser}
        onChange={(e) =>
          setPaidByUser(
            Number(e.target.value) > bill ? paidByUser : Number(e.target.value)
          )
        }
      />

      <label>🤼 {selectedFriend.name}'s expense</label>
      <input type='number' value={paidByFriend} disabled />

      <label>🤑 Who is paying the bill</label>
      <select
        value={whoIsPaying}
        onChange={(e) => setWhoIsPaying(e.target.value)}
      >
        <option value='user'>You</option>
        <option value='friend'>{selectedFriend.name}</option>
      </select>
      <Button>Split bill</Button>
    </form>
  );
}
