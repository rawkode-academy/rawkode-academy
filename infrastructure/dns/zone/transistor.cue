package zone

// #Transistor serves the domain as a Transistor podcast site from www, with
// the apex redirected there.
#Transistor: {
	#Zone
	name: _
	cname: {
		www: target: "domains.transistor.fm"
		"@": target: "www.\(name)"
	}
}
