const hypercore = require('hypercore')
const pump = require('pump')
const ram = require('random-access-memory')
const hs = require('../')

const server = hs.createServer(onrequest)

server.listen(3000, () => {
  const info = server.address()
  console.log('listening on:', info)
})

// 'req' and 'res' both wrap `hypercore-protocol` streams
// where 'req' represents the request and 'res' represents the
// response that can be replicated to. 'res.key' and 'res.secretKey'
// are ephemeral and generated on each websocket request
function onrequest(req, res) {
  const feed = hypercore(ram, req)
  const echo = hypercore(ram, res)

  // connect receiver and sender streams
  feed.replicate(req)
  echo.replicate(res)

  echo.once('upload', () => {
    res.destroy()
  })

  // read first packet and echo it back
  feed.get(0, (err, buf) => {
    if (err) {
      console.error(err)
    } else {
      echo.append(buf)
    }
  })
}
