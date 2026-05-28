(function () {
  const STORAGE_KEY = "nauxicaDemoState";

  const defaultState = {
    properties: [
      {
        id: "villa-mare",
        name: "Villa Mare",
        location: "Catania",
        occupancy: 78
      },
      {
        id: "casa-cielo",
        name: "Casa Cielo",
        location: "Taormina",
        occupancy: 64
      },
      {
        id: "penthouse-alba",
        name: "Penthouse Alba",
        location: "Giardini Naxos",
        occupancy: 92
      }
    ],

    tasks: [
      {
        id: "task-001",
        title: "Check in preparation",
        property: "Villa Mare",
        type: "check-in",
        priority: "normal",
        status: "pending"
      },
      {
        id: "task-002",
        title: "Bathroom light issue",
        property: "Casa Cielo",
        type: "maintenance",
        priority: "important",
        status: "pending"
      }
    ],

    partnerRequests: [
      {
  id: "req-001",
  service: "Checkout cleaning",
  property: "Villa Mare",
  partnerType: "cleaning",
  priority: "normal",
  description: "Full checkout cleaning before next guest arrival.",
  date: "Today",
  time: "11:00",
  payout: 65,
  notes: "Guest leaves at 10:00. Please check bathroom supplies.",
  status: "new",
  createdAt: "Today",
  updatedAt: "Today"
}
       ],

    notifications: [
  {
    id: "note-001",
    title: "New partner request created",
    message: "Checkout cleaning for Villa Mare is waiting for acceptance.",
    type: "request",
    createdAt: "Today",
    read: false
  }
],

messages: [
  {
    id: "msg-homeowner-001",
    accountType: "homeowner",
    type: "partner",
    from: "Etna Cleaning Co.",
    to: "homeowner",
    property: "Oceanview Villa",
    title: "Cleaning request accepted",
    body: "Etna Cleaning Co. has accepted the cleaning request for Oceanview Villa.",
    date: "Today",
    read: false,
    archived: false
  },
  {
    id: "msg-homeowner-002",
    accountType: "homeowner",
    type: "nauxica",
    from: "Nauxica",
    to: "homeowner",
    property: "Casa Ortigia",
    title: "Guest check-in reminder",
    body: "Your next guest is due to check in tomorrow at Casa Ortigia.",
    date: "Yesterday",
    read: true,
    archived: false
  },
  {
    id: "msg-partner-001",
    accountType: "partner",
    type: "owner",
    from: "Oceanview Villa",
    to: "partner",
    property: "Oceanview Villa",
    title: "Earlier arrival requested",
    body: "The owner asked whether you could arrive a bit earlier if possible.",
    date: "Today",
    read: false,
    archived: false
  },
  {
    id: "msg-partner-002",
    accountType: "partner",
    type: "nauxica",
    from: "Nauxica",
    to: "partner",
    property: "Villa Bellini",
    title: "New service opportunity",
    body: "A new maintenance request is available near one of your active areas.",
    date: "Today",
    read: false,
    archived: false
  }
],
calendarEvents: [
  {
    id: "cal-homeowner-001",
    accountType: "homeowner",
    title: "Guest check-in",
    property: "Casa Ortigia",
    category: "arrival",
    date: "Today",
    eventDate: "2026-05-27",
    time: "15:00",
    status: "today",
    description: "Guest arrival scheduled for this afternoon."
  },
  {
    id: "cal-homeowner-002",
    accountType: "homeowner",
    title: "Cleaning scheduled",
    property: "Oceanview Villa",
    category: "cleaning",
    date: "Tomorrow",
    eventDate: "2026-05-27",
    time: "10:30",
    status: "upcoming",
    description: "Partner cleaning visit confirmed."
  },
  {
    id: "cal-partner-001",
    accountType: "partner",
    title: "Deep cleaning job",
    property: "Sunset Villa",
    category: "cleaning",
    date: "Today",
    eventDate: "2026-05-27",
    time: "11:00",
    status: "today",
    description: "Assigned job for post checkout cleaning."
  },
  {
    id: "cal-partner-002",
    accountType: "partner",
    title: "Maintenance visit",
    property: "Riverside House",
    category: "maintenance",
    date: "Friday",
    eventDate: "2026-05-27",
    time: "14:00",
    status: "upcoming",
    description: "Minor maintenance task assigned by owner."
  }
]
};

  function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
      return defaultState;
    }

    try {
      return JSON.parse(saved);
    } catch (error) {
      console.warn("Nauxica demo state reset because saved data was invalid.");
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultState));
      return defaultState;
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function addTask(task) {
    const state = loadState();

    const newTask = {
      id: `task-${Date.now()}`,
      status: "pending",
      ...task
    };

    state.tasks.unshift(newTask);
    saveState(state);

    return newTask;
  }

  function addPartnerRequest(request) {
  const state = loadState();

  const newRequest = {
    id: `req-${Date.now()}`,
    service: request.service || "Operational request",
    property: request.property || "Unassigned property",
    partnerType: request.partnerType || "general",
    priority: request.priority || "normal",
    description: request.description || "",
    date: request.date || "Today",
    time: request.time || "",
    payout: Number(request.payout) || 0,
    notes: request.notes || "",
    status: "new",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.partnerRequests.unshift(newRequest);

  if (!state.notifications) {
    state.notifications = [];
  }

  state.notifications.unshift({
    id: `note-${Date.now()}`,
    title: "New job request",
    message: `${newRequest.service} for ${newRequest.property} is waiting for acceptance.`,
    type: "request-new",
    createdAt: new Date().toISOString(),
    read: false
  });

  saveState(state);

  return newRequest;
}

  function updatePartnerRequest(id, status) {
  const state = loadState();
  let updatedRequest = null;

  state.partnerRequests = state.partnerRequests.map(function (request) {
    if (request.id === id) {
      updatedRequest = {
        ...request,
        status,
        updatedAt: new Date().toISOString()
      };

      return updatedRequest;
    }

    return request;
  });

  if (updatedRequest) {
    if (!state.notifications) {
      state.notifications = [];
    }

    state.notifications.unshift({
      id: `note-${Date.now()}`,
      title: "Request status updated",
      message: `${updatedRequest.service} for ${updatedRequest.property} is now ${status}.`,
      type: `request-${status}`,
      createdAt: new Date().toISOString(),
      read: false
    });
  }

  saveState(state);
}

  function updateTaskStatus(id, status) {
  const state = loadState();

  state.tasks = state.tasks.map(function (task) {
    if (task.id === id) {
      return {
        ...task,
        status
      };
    }

    return task;
  });

  saveState(state);
}
function addNotification(notification) {
  const state = loadState();

  if (!state.notifications) {
    state.notifications = [];
  }

  const newNotification = {
    id: `note-${Date.now()}`,
    title: notification.title || "Nauxica update",
    message: notification.message || "",
    type: notification.type || "general",
    createdAt: new Date().toISOString(),
    read: false
  };

  state.notifications.unshift(newNotification);
  saveState(state);

  return newNotification;
}
function getCurrentAccountType() {
  return (
    localStorage.getItem("nauxicaAccountType") ||
    localStorage.getItem("accountType") ||
    "homeowner"
  );
}
function addMessage(message) {
  const state = loadState();

  if (!state.messages) {
    state.messages = [];
  }

  const newMessage = {
    id: `msg-${Date.now()}`,
    from: message.from || "owner",
    to: message.to || "partner",
    property: message.property || "Property",
    message: message.message || "",
    createdAt: new Date().toISOString(),
    read: false
  };

  state.messages.unshift(newMessage);
  saveState(state);

  return newMessage;
}

function markMessageRead(id) {
  const state = loadState();

  state.messages = (state.messages || []).map(function (message) {
    if (message.id === id) {
      return {
        ...message,
        read: true
      };
    }

    return message;
  });

  saveState(state);
}
function archiveMessage(id) {
  const state = loadState();

  state.messages = (state.messages || []).map(function (message) {
    if (message.id === id) {
      return {
        ...message,
        archived: true
      };
    }

    return message;
  });

  saveState(state);
}
  window.NauxicaDemoData = {
  loadState,
  saveState,
  addTask,
  addPartnerRequest,
  updatePartnerRequest,
  updateTaskStatus,
  addNotification,
  addMessage,
  markMessageRead,
  archiveMessage,
  getCurrentAccountType,
};
})();