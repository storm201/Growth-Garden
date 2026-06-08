"""Database models for Growth Garden.

The schema follows the PRD exactly:
    GardenBed  1--*  Plant  1--*  Update
                            1--*  PhotoMemory

Plant growth stage is NEVER stored. It is derived at read time from the
number of written Updates a plant has received (photos do not affect growth).
"""

from datetime import datetime

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


# --- Growth system -----------------------------------------------------------
# Growth depends solely on the total number of written updates.
GROWTH_STAGES = [
    # (minimum update count, emoji, label)
    (8, "🌲", "Mature Tree"),
    (4, "🌳", "Young Tree"),
    (1, "🌿", "Sprout"),
    (0, "🌱", "Seedling"),
]


def growth_for(update_count: int):
    """Return (emoji, label) for a given number of updates."""
    for threshold, emoji, label in GROWTH_STAGES:
        if update_count >= threshold:
            return emoji, label
    return "🌱", "Seedling"


class GardenBed(db.Model):
    __tablename__ = "garden_bed"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, unique=True, nullable=False)
    description = db.Column(db.Text, nullable=False, default="")

    plants = db.relationship(
        "Plant",
        back_populates="garden_bed",
        cascade="all, delete-orphan",
        order_by="Plant.created_at.desc()",
    )

    # Optional emoji used for the bed header (purely presentational).
    @property
    def emoji(self) -> str:
        return {
            "Goals": "🌟",
            "Projects": "📚",
            "Habits": "💪",
            "Memories": "📸",
        }.get(self.name, "🌱")


class Plant(db.Model):
    __tablename__ = "plant"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    garden_bed_id = db.Column(
        db.Integer, db.ForeignKey("garden_bed.id"), nullable=False
    )

    garden_bed = db.relationship("GardenBed", back_populates="plants")
    updates = db.relationship(
        "Update",
        back_populates="plant",
        cascade="all, delete-orphan",
        order_by="Update.created_at.desc()",
    )
    photos = db.relationship(
        "PhotoMemory",
        back_populates="plant",
        cascade="all, delete-orphan",
        order_by="PhotoMemory.uploaded_at.desc()",
    )

    # --- Derived growth (never stored) ---
    @property
    def update_count(self) -> int:
        return len(self.updates)

    @property
    def photo_count(self) -> int:
        return len(self.photos)

    @property
    def growth(self):
        return growth_for(self.update_count)

    @property
    def growth_emoji(self) -> str:
        return self.growth[0]

    @property
    def growth_stage(self) -> str:
        return self.growth[1]

    @property
    def is_fully_grown(self) -> bool:
        return self.update_count >= 8

    @property
    def growth_progress(self) -> int:
        """Percentage toward 'Mature Tree' (8 updates), capped at 100."""
        return min(100, round(self.update_count / 8 * 100))

    def timeline(self):
        """Combined, newest-first timeline of all activity for this plant."""
        events = [
            {
                "type": "created",
                "when": self.created_at,
                "title": "Plant created",
                "body": None,
            }
        ]
        for u in self.updates:
            events.append(
                {
                    "type": "update",
                    "when": u.created_at,
                    "title": "Update",
                    "body": u.content,
                }
            )
        for p in self.photos:
            events.append(
                {
                    "type": "photo",
                    "when": p.uploaded_at,
                    "title": "Photo memory added",
                    "body": p.caption,
                    "image_path": p.image_path,
                }
            )
        events.sort(key=lambda e: e["when"], reverse=True)
        return events


class Update(db.Model):
    __tablename__ = "update"

    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    plant_id = db.Column(db.Integer, db.ForeignKey("plant.id"), nullable=False)

    plant = db.relationship("Plant", back_populates="updates")


class PhotoMemory(db.Model):
    __tablename__ = "photo_memory"

    id = db.Column(db.Integer, primary_key=True)
    image_path = db.Column(db.String, nullable=False)
    caption = db.Column(db.String(255), nullable=False, default="")
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    plant_id = db.Column(db.Integer, db.ForeignKey("plant.id"), nullable=False)

    plant = db.relationship("Plant", back_populates="photos")


# --- Seed data ---------------------------------------------------------------
DEFAULT_BEDS = [
    ("Goals", "Milestones and ambitions you are nurturing toward fruition."),
    ("Projects", "Bodies of work you are building, one update at a time."),
    ("Habits", "Daily practices that grow stronger the more you tend them."),
    ("Memories", "Moments worth keeping, gathered as you go."),
]


def seed_beds():
    """Create the four predefined garden beds if they do not exist."""
    existing = {b.name for b in GardenBed.query.all()}
    for name, description in DEFAULT_BEDS:
        if name not in existing:
            db.session.add(GardenBed(name=name, description=description))
    db.session.commit()
