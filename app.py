"""Growth Garden — a single-user visual personal growth tracker.

Run with:  python app.py
Then open: http://127.0.0.1:5000
"""

import os
import uuid

from flask import (
    Flask,
    abort,
    flash,
    redirect,
    render_template,
    request,
    url_for,
)
from werkzeug.utils import secure_filename

from forms import PhotoForm, PlantForm, UpdateForm
from models import (
    GardenBed,
    PhotoMemory,
    Plant,
    Update,
    db,
    seed_beds,
)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads")

BED_ORDER = ["Goals", "Projects", "Habits", "Memories"]


def create_app():
    app = Flask(__name__)
    app.config.update(
        SECRET_KEY="growth-garden-local-secret",
        SQLALCHEMY_DATABASE_URI="sqlite:///"
        + os.path.join(BASE_DIR, "instance", "garden.db"),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        UPLOAD_FOLDER=UPLOAD_FOLDER,
        MAX_CONTENT_LENGTH=8 * 1024 * 1024,  # 8 MB uploads
    )

    os.makedirs(os.path.join(BASE_DIR, "instance"), exist_ok=True)
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    db.init_app(app)

    with app.app_context():
        db.create_all()
        seed_beds()

    # Make the current year available to every template (footer copyright).
    @app.context_processor
    def inject_globals():
        from datetime import datetime as _dt
        return {"now_year": _dt.utcnow().year}

    # Friendly date formatting, e.g. "June 8, 2026".
    @app.template_filter("niceday")
    def niceday(value):
        if not value:
            return ""
        fmt = "%B %#d, %Y" if os.name == "nt" else "%B %-d, %Y"
        return value.strftime(fmt)

    @app.template_filter("nicedatetime")
    def nicedatetime(value):
        if not value:
            return ""
        fmt = "%B %#d, %Y · %#I:%M %p" if os.name == "nt" else "%B %-d, %Y · %-I:%M %p"
        return value.strftime(fmt)

    register_routes(app)
    return app


def ordered_beds():
    """Return the four beds in the canonical order from the PRD."""
    beds = {b.name: b for b in GardenBed.query.all()}
    return [beds[name] for name in BED_ORDER if name in beds]


def register_routes(app):
    # ---- Hero / landing -----------------------------------------------------
    @app.route("/")
    def home():
        all_plants = Plant.query.all()
        stats = {
            "plants": len(all_plants),
            "updates": Update.query.count(),
            "photos": PhotoMemory.query.count(),
            "fully_grown": sum(1 for p in all_plants if p.is_fully_grown),
        }
        return render_template("hero.html", stats=stats)

    # ---- Dashboard ----------------------------------------------------------
    @app.route("/garden")
    @app.route("/dashboard")
    def dashboard():
        beds = ordered_beds()
        all_plants = Plant.query.all()

        stats = {
            "plants": len(all_plants),
            "updates": Update.query.count(),
            "photos": PhotoMemory.query.count(),
            "fully_grown": sum(1 for p in all_plants if p.is_fully_grown),
        }
        return render_template("dashboard.html", beds=beds, stats=stats)

    # ---- Create plant -------------------------------------------------------
    @app.route("/plant/new", methods=["GET", "POST"])
    def create_plant():
        form = PlantForm()
        form.garden_bed_id.choices = [
            (b.id, f"{b.emoji}  {b.name}") for b in ordered_beds()
        ]

        if form.validate_on_submit():
            plant = Plant(
                title=form.title.data.strip(),
                description=form.description.data.strip(),
                garden_bed_id=form.garden_bed_id.data,
            )
            db.session.add(plant)
            db.session.commit()
            flash(f"“{plant.title}” has been planted. 🌱", "success")
            return redirect(url_for("dashboard"))

        # Pre-select a bed if passed via query string (e.g. from a bed header).
        if request.method == "GET":
            requested = request.args.get("bed", type=int)
            if requested:
                form.garden_bed_id.data = requested

        # Optional: a real potting-bench photo at static/img/create-bg.jpg
        # replaces the illustrated scene automatically.
        bg_path = os.path.join(BASE_DIR, "static", "img", "create-bg.jpg")
        has_bg = os.path.exists(bg_path)

        return render_template(
            "create_plant.html", form=form, has_bg_image=has_bg
        )

    # ---- Plant detail -------------------------------------------------------
    @app.route("/plant/<int:plant_id>")
    def plant_detail(plant_id):
        plant = db.session.get(Plant, plant_id) or abort(404)
        return render_template(
            "plant_detail.html",
            plant=plant,
            timeline=plant.timeline(),
            update_form=UpdateForm(),
            photo_form=PhotoForm(),
        )

    # ---- Add update ---------------------------------------------------------
    @app.route("/plant/<int:plant_id>/update", methods=["GET", "POST"])
    def add_update(plant_id):
        plant = db.session.get(Plant, plant_id) or abort(404)
        form = UpdateForm()
        if form.validate_on_submit():
            previous_stage = plant.growth_stage
            db.session.add(
                Update(content=form.content.data.strip(), plant_id=plant.id)
            )
            db.session.commit()

            if plant.growth_stage != previous_stage:
                flash(
                    f"Watered! “{plant.title}” grew into a {plant.growth_stage}. "
                    f"{plant.growth_emoji}",
                    "success",
                )
            else:
                flash("Update added. Your plant is a little stronger. 🌿", "success")
            return redirect(url_for("plant_detail", plant_id=plant.id))

        return render_template("add_update.html", plant=plant, form=form)

    # ---- Upload photo memory ------------------------------------------------
    @app.route("/plant/<int:plant_id>/photo", methods=["GET", "POST"])
    def upload_photo(plant_id):
        plant = db.session.get(Plant, plant_id) or abort(404)
        form = PhotoForm()
        if form.validate_on_submit():
            file = form.image.data
            ext = file.filename.rsplit(".", 1)[-1].lower()
            stored_name = f"{uuid.uuid4().hex}.{ext}"
            stored_name = secure_filename(stored_name)
            file.save(os.path.join(app.config["UPLOAD_FOLDER"], stored_name))

            db.session.add(
                PhotoMemory(
                    image_path=f"uploads/{stored_name}",
                    caption=(form.caption.data or "").strip(),
                    plant_id=plant.id,
                )
            )
            db.session.commit()
            flash("Photo memory added to your plant. 📸", "success")
            return redirect(url_for("plant_detail", plant_id=plant.id))

        return render_template("upload_photo.html", plant=plant, form=form)

    # ---- Delete plant -------------------------------------------------------
    @app.route("/plant/<int:plant_id>/delete", methods=["POST"])
    def delete_plant(plant_id):
        plant = db.session.get(Plant, plant_id) or abort(404)

        # Remove associated image files from disk before cascade delete.
        for photo in plant.photos:
            path = os.path.join(BASE_DIR, "static", photo.image_path)
            if os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass

        title = plant.title
        db.session.delete(plant)
        db.session.commit()
        flash(f"“{title}” was removed from your garden.", "success")
        return redirect(url_for("dashboard"))

    # ---- Errors -------------------------------------------------------------
    @app.errorhandler(404)
    def not_found(_):
        return render_template("error.html", code=404,
                               message="That page could not be found."), 404

    @app.errorhandler(413)
    def too_large(_):
        flash("That image is too large. Please upload a file under 8 MB.", "error")
        return redirect(request.referrer or url_for("dashboard")), 413


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
