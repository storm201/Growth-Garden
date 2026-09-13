import os
import re

from app import app
from models import Plant, db

with app.test_client() as c:
    r = c.get("/plant/new")
    assert r.status_code == 200
    html = r.get_data(as_text=True)
    assert ("vine-stem" in html and "create-scene" in html
            and "create-scene--photo" not in html)

    token = re.search(r'name="csrf_token"[^>]*value="([^"]+)"', html).group(1)
    r2 = c.post(
        "/plant/new",
        data={"csrf_token": token, "title": "Test Ivy", "description": "desc", "garden_bed_id": 1},
        follow_redirects=True,
    )
    body = r2.get_data(as_text=True)
    assert r2.status_code == 200 and "Test Ivy" in body, "POST failed"
    print("form POST OK, plant created")

    os.makedirs("static/img", exist_ok=True)
    with open("static/img/create-bg.jpg", "wb") as f:
        f.write(b"x")
    html2 = c.get("/plant/new").get_data(as_text=True)
    assert "create-bg.jpg" in html2 and "create-scene--photo" in html2
    print("photo override OK")
    os.remove("static/img/create-bg.jpg")
    os.rmdir("static/img")

with app.app_context():
    Plant.query.delete()
    db.session.commit()
print("cleanup done")
