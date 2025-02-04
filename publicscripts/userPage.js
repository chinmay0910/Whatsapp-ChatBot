// Initialize Lucide icons
lucide.createIcons();

// Mock data for demonstration

// Initialize state
let users = [];
let originalUsers = []; // Store the original users list


let sortField = 'name';
let sortDirection = 'asc';
let currentPage = 1;
const itemsPerPage = 10;

async function fetchUsers() {
    try {
        const response = await fetch('/api/quiz/users', {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Auth-token": localStorage.getItem('Auth-token')
            },
        });
        const data = await response.json();
        users = [...data]; // Create a new copy of users data
        originalUsers = [...data]; // Save original data for filtering
        renderUsers();
    } catch (error) {
        console.error('Error fetching users:', error);
    }
}

// Format date
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Update pagination controls
function updatePaginationControls() {
    const totalPages = Math.ceil(users.length / itemsPerPage);
    document.getElementById('pageInfo').innerHTML = `Showing <span class="font-medium">${currentPage}</span> of 
    <span class="font-medium">${totalPages}</span> pages`;

    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

// Next Page
document.getElementById('nextPage').addEventListener('click', () => {
    if (currentPage < Math.ceil(users.length / itemsPerPage)) {
        currentPage++;
        renderUsers();
        updatePaginationControls();
    }
});

// Previous Page
document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderUsers();
        updatePaginationControls();
    }
});

// Render users table
function renderUsers() {
    const tableBody = document.getElementById('userTableBody');
    tableBody.innerHTML = '';

    const start = (currentPage - 1) * itemsPerPage;
    const paginatedUsers = users.slice(start, start + itemsPerPage);

    paginatedUsers.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
                  <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                          <div class="flex-shrink-0 h-10 w-10">
                              <img class="h-10 w-10 rounded-full" src="https://static.vecteezy.com/system/resources/previews/032/176/191/non_2x/business-avatar-profile-black-icon-man-of-user-symbol-in-trendy-flat-style-isolated-on-male-profile-people-diverse-face-for-social-network-or-web-vector.jpg" alt="">
                          </div>
                          <div class="ml-4">
                              <div class="text-sm font-medium text-gray-900">${user.name}</div>
                              <div class="text-sm text-gray-500">${user.userId}</div>
                          </div>
                      </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-900">${user.email}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                          <div class="text-sm font-medium text-gray-900">${user.score}%</div>
                          <div class="ml-2 flex-1 w-24">
                              <div class="overflow-hidden h-2 text-xs flex rounded bg-gray-100">
                                  <div style="width:${user.score}%" class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"></div>
                              </div>
                          </div>
                      </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                          ${user.verified ? 'Verified' : 'Pending'}
                      </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.paymentVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                          ${user.paymentVerified ? 'Paid' : 'Unpaid'}
                      </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${formatDate(user.createdAt)}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button class="text-blue-600 hover:text-blue-900" onclick="alert('Coming Soon!')">View</button>
                      <button class="ml-4 text-gray-600 hover:text-gray-900" onclick="alert('Coming Soon!')">Edit</button>
                  </td>
              `;
        tableBody.appendChild(row);
    });

    // updateStats();
}

// Sort users
function sortUsers(field) {

    if (sortField === field) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortField = field;
        sortDirection = 'asc';
    }

    users.sort((a, b) => {
        let comparison = 0;

        // Handle date sorting separately
        if (field === "date") {
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            comparison = dateA - dateB;
        } else {
            if (a[field] < b[field]) comparison = -1;
            if (a[field] > b[field]) comparison = 1;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
    });

    renderUsers();
}

// Filter users
function filterUsers() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const verificationStatus = document.getElementById('verificationStatus').value;
    const quizStatus = document.getElementById('quizStatus').value;
    const paymentStatus = document.getElementById('paymentStatus').value;
    const minScore = document.getElementById('minScore').value;
    const maxScore = document.getElementById('maxScore').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    users = originalUsers.filter(user => {
        const matchesSearch = !searchTerm ||
            user.name.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm) ||
            user.userId.toLowerCase().includes(searchTerm);

        const matchesVerification = !verificationStatus ||
            (verificationStatus === 'verified' && user.verified) ||
            (verificationStatus === 'unverified' && !user.verified);

        const matchesQuizStatus = !quizStatus ||
            (quizStatus === 'completed' && user.quizCompleted) ||
            (quizStatus === 'inProgress' && !user.quizCompleted && user.questionIndex > 0) ||
            (quizStatus === 'notStarted' && user.questionIndex === 0);

        const matchesPayment = !paymentStatus ||
            (paymentStatus === 'verified' && user.paymentVerified) ||
            (paymentStatus === 'pending' && !user.paymentVerified);

        const matchesScore = (!minScore || user.score >= minScore) &&
            (!maxScore || user.score <= maxScore);

        const userDate = new Date(user.createdAt);
        const matchesDate = (!startDate || userDate >= new Date(startDate)) &&
            (!endDate || userDate <= new Date(endDate));

        return matchesSearch && matchesVerification && matchesQuizStatus &&
            matchesPayment && matchesScore && matchesDate;
    });

    currentPage = 1;
    renderUsers();
}

// Export to Excel
function exportToExcel() {
    const ws = XLSX.utils.json_to_sheet(users.map(user => ({
        Name: user.name,
        UserID: user.userId,
        Email: user.email,
        Score: `${user.score}%`,
        Verification: user.verified ? 'Verified' : 'Pending',
        Payment: user.paymentVerified ? 'Paid' : 'Unpaid',
        CreatedAt: formatDate(user.createdAt)
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, "UsersData.xlsx");
}

document.getElementById('exportExcel').addEventListener('click', exportToExcel);

// Event listeners
document.querySelectorAll('.sortable').forEach(header => {
    header.addEventListener('click', () => sortUsers(header.dataset.sort));
});

document.querySelectorAll('select, input').forEach(element => {
    element.addEventListener('change', filterUsers);
});

document.getElementById('search').addEventListener('input', filterUsers);

// Initial render
fetchUsers();
// renderUsers();