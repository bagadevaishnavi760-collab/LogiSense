from flask import Flask, render_template


app = Flask(__name__)


@app.route("/")
def dashboard():
    return render_template("dashboard.html")


@app.route("/analytics")
def analytics():
    return render_template("analytics.html")


@app.route("/prediction")
def prediction():
    return render_template("prediction.html")


@app.route("/olap")
def olap():
    return render_template("olap.html")


@app.route("/admin")
def admin():
    return render_template("admin.html")


if __name__ == "__main__":
    app.run(debug=True)
    