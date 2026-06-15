async function testSpreadsheet() {
  const url = "https://script.google.com/macros/s/AKfycbyq1B_7D2saPLfHISuwJrJI8PkUiQrgK3sDetSQE0rbcnTjSvXqKE0Dzl5gw4rB_xw7/exec";
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log('Sample item:', data[0]);
    console.log('Keys of sample item:', Object.keys(data[0]));
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}
testSpreadsheet();
