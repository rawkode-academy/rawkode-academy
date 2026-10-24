package zone

// #NoEmail publishes an SPF policy that no server may send for the domain.
// Every email mixin claims `txt: "@": spf`, so combining two is a conflict.
#NoEmail: {
	#Zone
	txt: "@": spf: value: "v=spf1 ~all"
}
