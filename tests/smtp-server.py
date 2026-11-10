"""Isolated SMTP sink: STARTTLS and AUTH LOGIN, no forwarding or message storage."""
import argparse, socketserver, ssl
p=argparse.ArgumentParser();p.add_argument('--host',default='127.0.0.1');p.add_argument('--port',type=int,default=2525);p.add_argument('--cert',required=True);p.add_argument('--key',required=True);a=p.parse_args()
ctx=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);ctx.load_cert_chain(a.cert,a.key)
class SMTP(socketserver.StreamRequestHandler):
 def send(self,line):self.wfile.write((line+'\r\n').encode());self.wfile.flush()
 def handle(self):
  self.send('220 qa.test ESMTP');tls=False;auth=0
  while True:
   raw=self.rfile.readline(65536)
   if not raw:return
   text=raw.decode(errors='replace').strip();cmd=text.split(' ',1)[0].upper()
   if auth:
    if auth==1:auth=2;self.send('334 UGFzc3dvcmQ6')
    else:auth=0;self.send('235 Authentication accepted')
   elif cmd in ('EHLO','HELO'):
    self.send('250-qa.test');self.send('250-AUTH LOGIN' if tls else '250-STARTTLS');self.send('250 OK')
   elif cmd=='STARTTLS':
    self.send('220 Ready to start TLS');self.connection=ctx.wrap_socket(self.connection,server_side=True);self.rfile=self.connection.makefile('rb');self.wfile=self.connection.makefile('wb');tls=True
   elif cmd=='AUTH':
    if not tls:self.send('530 STARTTLS required')
    else:auth=1;self.send('334 VXNlcm5hbWU6')
   elif cmd=='RCPT':self.send('550 QA rejection' if 'fail@example.test' in text else '250 Recipient accepted')
   elif cmd=='DATA':
    self.send('354 End with a dot')
    while True:
     line=self.rfile.readline(65536)
     if not line or line==b'.\r\n':break
    self.send('250 Message accepted by local QA sink')
   elif cmd=='QUIT':self.send('221 Bye');return
   else:self.send('250 OK')
class Server(socketserver.ThreadingTCPServer):allow_reuse_address=True;daemon_threads=True
with Server((a.host,a.port),SMTP) as server:server.serve_forever()
