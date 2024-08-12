var helpers = {}


helpers.manageResponse = (res, data, error) => {
    if (error == null) {
        return res.status(200).json(data)
    } else {
        console.log(error);
        console.log(data);
        return res.status(500).json(error);
    }
}


module.exports = helpers;



