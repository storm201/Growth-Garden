"""WTForms definitions for Growth Garden."""

from flask_wtf import FlaskForm
from flask_wtf.file import FileAllowed, FileField, FileRequired
from wtforms import SelectField, StringField, TextAreaField
from wtforms.validators import DataRequired, Length

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}


class PlantForm(FlaskForm):
    title = StringField(
        "Title",
        validators=[
            DataRequired(message="Please give your plant a title."),
            Length(max=100, message="Title must be 100 characters or fewer."),
        ],
    )
    description = TextAreaField(
        "Description",
        validators=[DataRequired(message="A short description helps you remember why you planted this.")],
    )
    garden_bed_id = SelectField(
        "Garden bed",
        coerce=int,
        validators=[DataRequired(message="Choose a garden bed.")],
    )


class UpdateForm(FlaskForm):
    content = TextAreaField(
        "Update",
        validators=[DataRequired(message="An update cannot be empty.")],
    )


class PhotoForm(FlaskForm):
    image = FileField(
        "Image",
        validators=[
            FileRequired(message="Please choose an image to upload."),
            FileAllowed(
                ALLOWED_EXTENSIONS,
                message="Only JPG, JPEG, PNG, and WEBP files are supported.",
            ),
        ],
    )
    caption = StringField(
        "Caption",
        validators=[Length(max=255, message="Caption must be 255 characters or fewer.")],
    )
