/**
 * Example proxy list file for proxy-connection
 *
 * WARNING: This is an example file!
 * Replace this data with your real working proxies
 *
 * Proxy format:
 * {
 *   ip: 'Proxy server IP address',
 *   port: 'Proxy server port',
 *   user: 'Username for authentication (optional)',
 *   pass: 'Password for authentication (optional)'
 * }
 */

module.exports = [
  // Example proxy with authentication
  {
    ip: '1.2.3.4',
    port: 1080,
    user: 'your_username',
    pass: 'your_password'
  },

  // Example proxy without authentication
  {
    ip: '5.6.7.8',
    port: 1080
  }

  // Add your working proxies here
  // {
  //   ip: 'your_proxy_ip',
  //   port: your_proxy_port,
  //   user: 'username',  // if required
  //   pass: 'password'   // if required
  // },
];

/**
 * How to get a proxy list:
 *
 * 1. Buy proxies from a reliable provider
 * 2. Get the IP:PORT list with logins/passwords
 * 3. Replace the examples above with your data
 * 4. Make sure the proxies support SOCKS5 protocol
 * 5. Test functionality with command: npm test
 *
 * Recommended proxy providers:
 * - ProxyEmpire
 * - Smartproxy
 * - Oxylabs
 * - NetNut
 *
 * IMPORTANT: Never commit real proxy data to Git!
 * Add proxies-list.js to .gitignore
 */
