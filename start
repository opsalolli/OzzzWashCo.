<!DOCTYPE html>
<html>
<head>
  <title>Ozzz CRM</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="apple-mobile-web-app-capable" content="yes">

  <style>
    body { font-family: Arial; background:#0b1220; color:white; padding:15px; }
    input, button { padding:10px; margin:5px; border-radius:8px; border:none; }
    button { background:#3b82f6; color:white; }
    .card { background:#111a2b; padding:15px; border-radius:12px; margin:10px 0; }
  </style>
</head>

<body>

<h2>Ozzz CRM</h2>

<div class="card">
  <h3>Add Customer</h3>
  <input id="name" placeholder="Customer Name">
  <input id="phone" placeholder="Phone Number">
  <button onclick="addCustomer()">Save Customer</button>
</div>

<div class="card">
  <h3>Create Job</h3>
  <input id="windows" type="number" placeholder="Windows">
  <input id="price" type="number" placeholder="Price per window">
  <button onclick="createJob()">Create Job</button>
</div>

<div class="card">
  <h3>Customers</h3>
  <ul id="customerList"></ul>
</div>

<div class="card">
  <h3>Job History</h3>
  <ul id="jobList"></ul>
</div>

<div class="card">
  <h3>Door Knocking Tracker</h3>
  <button onclick="addDoor()">+ Door Knocked</button>
  <p id="doors">0</p>
</div>

<div class="card">
  <h3>Location (Map)</h3>
  <button onclick="getLocation()">Get Location</button>
  <p id="location">Not set</p>
</div>

<script>
let customers = JSON.parse(localStorage.getItem("customers")) || [];
let jobs = JSON.parse(localStorage.getItem("jobs")) || [];
let doors = localStorage.getItem("doors") || 0;

function save() {
  localStorage.setItem("customers", JSON.stringify(customers));
  localStorage.setItem("jobs", JSON.stringify(jobs));
  localStorage.setItem("doors", doors);
}

function addCustomer() {
  let name = document.getElementById("name").value;
  let phone = document.getElementById("phone").value;

  if (!name) return alert("Enter name");

  customers.push({ name, phone });
  save();
  render();
}

function createJob() {
  let windows = document.getElementById("windows").value;
  let price = document.getElementById("price").value;

  let total = windows * price;

  jobs.push({ windows, price, total, date: new Date().toLocaleDateString() });
  save();
  render();
}

function addDoor() {
  doors++;
  save();
  document.getElementById("doors").innerText = doors;
}

function render() {
  let cList = document.getElementById("customerList");
  cList.innerHTML = "";
  customers.forEach(c => {
    cList.innerHTML += `<li>${c.name} - ${c.phone}</li>`;
  });

  let jList = document.getElementById("jobList");
  jList.innerHTML = "";
  jobs.forEach(j => {
    jList.innerHTML += `<li>$${j.total} (${j.windows} windows)</li>`;
  });

  document.getElementById("doors").innerText = doors;
}

function getLocation() {
  navigator.geolocation.getCurrentPosition(pos => {
    let lat = pos.coords.latitude;
    let lon = pos.coords.longitude;
    document.getElementById("location").innerText = lat + ", " + lon;
  });
}

render();
</script>

</body>
</html>
