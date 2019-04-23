hypersource
===========

Build WebSocket APIs that leverage the HyperCore Protocol

## Installation

```sh
$ npm install hypersource
```

## Example

Below creates a web socket server that echos the first value as a
response.

```js
// can use hyperdrive, hypertrie, or hyperdb too
const hypercore = require('hypercore')
const ram = require('random-access-memory')
const hs = require('hypersource')

const server = hs.createServer((req, res) => {
  console.log('request from:', req.url)

  // 'req.key' points to the public key for this feed
  const reader = hypercore(ram, req)

  // 'res.key' and 'res.secretKey' contain the ephemeral key pair
  // used for writing a response. The public key is stored in the
  // 'userData' of the handshake
  const writer = hypercore(ram, res)

  // replicate from request
  reader.replicate(req)
  // replicate to response
  writer.replicate(res)

  // echo first value to writer
  reader.get(0, (err, buf) => writer.append(buf))

  // close response when writer uploads
  writer.once('upload', () => res.destroy())
})

server.listen(3000, () => {
  const { protocol, address, port } = server.address()
  console.log('Listening on %s//%s:%s', protocol, address, port)
})
```

Using [simple-websocket](https://github.com/feross/simple-websocket) we
can connect to this host and initiate a request.

```js
const WebSocket = require('simple-websocket')
const hypercore = require('hypercore')
const pump = require('pump')
const ram = require('random-access-memory')

const request = hypercore(ram)
request.ready(() => {
  const key = request.key.toString('hex')
  const stream = request.replicate({ live: true })
  const socket = new WebSocket(`ws://localhost:3000/${key}`)

  pump(stream, socket, stream).once('handshake', () => {
    const remotePublicKey = stream.remoteUserData
    const response = hypercore(ram, remotePublicKey)

    request.append('hello world')
    response.replicate({ stream, live: true })
    response.get(0, (err, res) => {
      console.log('response', res.toString()); // 'hello world'
    })
  })
})

```

## API

### `server = hs.createServer([opts[, onrequest]])`

Create a new hypersource web socket server where `onrequest` is called
when the `'request'` event is emitted and `opts` is an optional object
that is passed directly to
[simple-websocket `Server`](https://github.com/feross/simple-websocket#server).

#### `server.listen(port[, host[, callback]])`

Listen on `port` on an optional `host` calling `callback` when the
`'listening'` event is fired.

#### `addrinfo = server.address()`

Returns the address info for the server.

```js
const addrinfo = server.address() // { protocol: 'ws:', address: '::', family: 'IPv6', port: 3000 }
```

#### `server.close()`

Close the server.

#### `server.on('error', error)`

Emitted when an error occurs.

#### `server.on('connection', socket, httpRequest)`

Emitted when a connection has been established where `socket` is a
`Duplex` stream that wraps the underlying web socket and `httpRequest` is a
`http.IncomingMessage` containing HTTP request information.

#### `server.on('request', request, response, discoveryKey)`

Emitted when a request has been established where `request` and
`response` both wrap
[hypercore-protocol](https://github.com/mafintosh/hypercore-protocol)
streams and `discoveryKey` is the discovery key for the request.

The `request` and `response` object contains useful properties for
creating hypercore instances and replicating their feeds.

##### `request.url`

The URL associated with the request.

##### `request.method`

The HTTP method associated with the request.

##### `request.headers`

The HTTP headers associated with the request.

##### `request.key`

The public key associated with the request.

##### `request.publicKey`

An alias to `request.key`.

##### `request.discoveryKey`

The discovery key associated with the request.

##### `request.stream`

The [hypercore-protocol](https://github.com/mafintosh/hypercore-protocol)
stream that is associated with the request.

##### `response.key`

The public key associated with the response.

##### `response.publicKey`

An alias to `response.key`.

##### `response.secretKey`

The secret key associated with the response.

##### `response.discoveryKey`

The discovery key associated with the response.

##### `request.stream`

The [hypercore-protocol](https://github.com/mafintosh/hypercore-protocol)
stream that is associated with the request.

## License

MIT
