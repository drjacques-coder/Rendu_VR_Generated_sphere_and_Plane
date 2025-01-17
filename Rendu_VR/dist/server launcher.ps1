Start-Process python -ArgumentList "server.py"
Start-Sleep -Seconds 2
Start-Process "http://localhost:8000/index.html"