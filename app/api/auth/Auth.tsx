import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Ticket, Admin } from './types';
import { useRef } from 'react';

const APP_SCRIPT_USER_URL = "https://script.google.com/macros/s/AKfycbxcoCDXcWlKPDbttlFf2eR_EeuMkfupy5dfgIOklM1ShEZ30gfD3wzZZOxkKV4xIWEl/exec?sheetname=user";
const APP_SCRIPT_TICKET_URL = "https://script.google.com/macros/s/AKfycbxcoCDXcWlKPDbttlFf2eR_EeuMkfupy5dfgIOklM1ShEZ30gfD3wzZZOxkKV4xIWEl/exec?sheetname=ticket";
const APP_SCRIPT_ADMIN_URL = "https://script.google.com/macros/s/AKfycbwXIfuadHykMFrMdPPLLP7y0pm4oZ8TJUnM9SMmDp9BkaVLGu9jupU-CuW8Id-Mm1ylxg/exec?sheetname=admin";

interface UserContextProps {
    user: User | null;
    users: User[];
    ticket: Ticket | null;
    tickets: Ticket[];
    admin: Admin | null;
    loading: boolean;
    setUser: React.Dispatch<React.SetStateAction<User | null>>;
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    setTicket: React.Dispatch<React.SetStateAction<Ticket | null>>;
    setTickets: React.Dispatch<React.SetStateAction<Ticket[]>>;
    setAdmin: React.Dispatch<React.SetStateAction<Admin | null>>;
    setLoading: React.Dispatch<React.SetStateAction<boolean>>; // Add setLoading here
    fetchAllUsers: () => Promise<void>;
    fetchAllTickets: () => Promise<void>;
    fetchAdminData: (username: string, password: string) => Promise<boolean>;
}

const UserContext = createContext<UserContextProps>({
    user: null,
    users: [],
    ticket: null,
    tickets: [],
    admin: null,
    loading: true,
    setUser: () => { },
    setUsers: () => { },
    setTicket: () => { },
    setTickets: () => { },
    setAdmin: () => { },
    setLoading: () => { }, // Add setLoading here
    fetchAllUsers: async () => { },
    fetchAllTickets: async () => { },
    fetchAdminData: async () => false,
});

export const UserProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [admin, setAdmin] = useState<Admin | null>(null);
    const [loading, setLoading] = useState(true);
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialLoad = useRef(true);

    const fetchWithRetry = async (url: string, retries = 3) => {
      let attempt = 0;
      while (attempt < retries) {
          try {
              const response = await fetch(url);
              if (!response.ok) throw new Error("Network response was not ok");
              return await response.json();
          } catch (error) {
              attempt++;
              if (attempt < retries) {
                  await new Promise(resolve => setTimeout(resolve, 60000)); // 60,000 milliseconds = 1 minute
              } else {
                  console.error("Failed to fetch after multiple attempts:", error);
                  throw error;
              }
          }
      }
  };

  const fetchAdminData = async (username: string, password: string): Promise<boolean> => {
    try {
      //setLoading(true);
      const data: Admin[] = await fetchWithRetry(APP_SCRIPT_ADMIN_URL);
      const adminData = data.find((admin) => admin.username === username && admin.password === password);
      if (adminData) {
        setAdmin(adminData);
        sessionStorage.setItem("loggedInAdmin", username);
        sessionStorage.setItem("adminData", JSON.stringify(adminData));
        return true;
      } else {
        alert("Invalid admin credentials!");
        sessionStorage.removeItem("loggedInAdmin");
        sessionStorage.removeItem("adminData");
        setAdmin(null);
        return false;
      }
    } catch (error) {
      console.error("Error fetching admin data:", error);
      return false;
    } finally {
      //setLoading(false);
    }
  };

  const fetchUserData = async (id: string) => {
    try {
      //setLoading(true);
      const data: User[] = await fetchWithRetry(APP_SCRIPT_USER_URL);
      const userData = data.find((row: User) => row.userId === id);
      if (userData) {
        setUser(userData);
      } else {
        //router.push('/invalid');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      //router.push('/invalid');
    } finally {
      //setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      //setLoading(true);
      const data: User[] = await fetchWithRetry(APP_SCRIPT_USER_URL);
      setUsers(data);
      localStorage.setItem('allUsersData', JSON.stringify(data));
    } catch (error) {
      console.error('Error fetching all users:', error);
    } finally {
      //setLoading(false);
    }
  };

  const fetchTicketData = async (ticketId: string) => {
    try {
      //setLoading(true);
      const data: Ticket[] = await fetchWithRetry(APP_SCRIPT_TICKET_URL);
      const ticketData = data.find((row: Ticket) => row.ticketId === ticketId);
      if (ticketData) {
        setTicket(ticketData);
        localStorage.setItem('ticketData', JSON.stringify(ticketData));
      }
    } catch (error) {
      console.error('Error fetching ticket data:', error);
    } finally {
      //setLoading(false);
    }
  };

  const fetchAllTickets = async () => {
    try {
      //setLoading(true);
      const data: Ticket[] = await fetchWithRetry(APP_SCRIPT_TICKET_URL);
      setTickets(data);
      localStorage.setItem('allTicketsData', JSON.stringify(data));
    } catch (error) {
      console.error('Error fetching all tickets:', error);
    } finally {
      //setLoading(false);
    }
  };

  const refreshData = () => {
      initialLoad.current = true;
  };

  useEffect(() => {
      const idFromUrl = searchParams.get('id');
      const cachedAllUsersData = localStorage.getItem('allUsersData');
      const cachedAllTicketsData = localStorage.getItem('allTicketsData');
      const currentPath = window.location.pathname;

      if (idFromUrl) {
          fetchUserData(idFromUrl);
      } else if (!currentPath.startsWith('/admin')) {
          //router.push('/invalid');
      }

      if (user && user.ticketId) {
          fetchTicketData(user.ticketId);
      }

      if (initialLoad.current) {
          initialLoad.current = false;

          if (cachedAllUsersData) {
              try {
                  const usersData = JSON.parse(cachedAllUsersData);
                  setUsers(usersData);
              } catch (e) {
                  console.error("Error parsing cached all users data", e);
                  localStorage.removeItem('allUsersData');
                  fetchAllUsers();
              }
          } else {
              fetchAllUsers();
          }

          if (cachedAllTicketsData) {
              try {
                  const ticketsData = JSON.parse(cachedAllTicketsData);
                  setTickets(ticketsData);
              } catch (e) {
                  console.error("Error parsing cached all tickets data", e);
                  localStorage.removeItem('allTicketsData');
                  fetchAllTickets();
              }
          } else {
              fetchAllTickets();
          }
      }

      if (idFromUrl && user && user.userId !== idFromUrl) {
          localStorage.removeItem('ticketData');
          setTicket(null);
      }
  }, [searchParams, router, user]);

  // Add this to your useEffect in UserContext.tsx
  useEffect(() => {
    // Check for stored admin data
    const loggedInAdminUsername = sessionStorage.getItem("loggedInAdmin");
    const storedAdminData = sessionStorage.getItem("adminData");
    
    if (storedAdminData) {
      try {
        setAdmin(JSON.parse(storedAdminData));
      } catch (e) {
        console.error("Error parsing stored admin data", e);
        sessionStorage.removeItem("adminData");
      }
    } else if (loggedInAdminUsername) {
      // If we only have the username but not the full data, try to fetch it
      fetchAdminData(loggedInAdminUsername, ""); // Password will be ignored in this case
    }
  }, []);

  return (
      <UserContext.Provider
          value={{
              user,
              users,
              ticket,
              tickets,
              admin,
              loading,
              setUser,
              setUsers,
              setTicket,
              setTickets,
              setAdmin,
              setLoading, // Add setLoading here
              fetchAllUsers,
              fetchAllTickets,
              fetchAdminData,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
