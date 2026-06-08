// Quick script to set admin token for testing
// Run this in browser console or include in page

(function() {
  const ADMIN_TOKEN = 'dev-admin-token';
  
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('admin_token', ADMIN_TOKEN);
    localStorage.setItem('token', ADMIN_TOKEN); // Backup
    
    console.log('✅ Admin token set successfully!');
    console.log('Token:', ADMIN_TOKEN);
    console.log('You can now refresh the page to test Fee Rules UI');
    
    // Optional: Auto reload
    // window.location.reload();
  } else {
    console.error('❌ localStorage not available');
  }
})();




